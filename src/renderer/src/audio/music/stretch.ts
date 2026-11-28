import { AudioSource } from '../dsp/audioSource'
import { hann } from '../dsp/fft'
import { parabolicOffset } from '../dsp/peakFit'
import { mean } from '../dsp/stats'
import { clamp } from '../dsp/units'
import { bufferOf, cachedRender, channelsOf } from '../dsp/renderCache'
import { lowpass, nextTick } from '../dsp/resample'
import { onsetStrength } from '../dsp/onsets'

// --- Tempo ---------------------------------------------------------------------

// The tempo is steady through most songs; a minute and a half is plenty to hear it.
const TEMPO_ANALYSIS_SEC = 90
const MIN_BPM = 60
const MAX_BPM = 200
// Songs cluster around 120 BPM. Weighting toward it settles half- and double-time
// mix-ups the way a listener would (Ellis, "Beat Tracking by Dynamic Programming").
const PREFERRED_BPM = 120
const PREFERENCE_OCTAVES = 1
// Reading the beat across four of them pins the tempo far finer than one beat could.
const REFINE_BEATS = 4
const SEC_PER_MIN = 60
// Below this much onset energy there are no beats to hear.
const MIN_ONSET_ENERGY = 1e-3

function autocorrelation(x: Float32Array, lag: number): number {
  let sum = 0
  for (let i = lag; i < x.length; i++) sum += x[i] * x[i - lag]
  return sum / (x.length - lag)
}

/** The peak of `score` near `around`, between whole lags (a parabola through three). */
function peakNear(score: (lag: number) => number, around: number, reach: number): number {
  let best = around
  for (let lag = around - reach; lag <= around + reach; lag++) {
    if (lag > 1 && score(lag) > score(best)) best = lag
  }
  return best + parabolicOffset(score(best - 1), score(best), score(best + 1), 'peak')
}

/** A music's beat: its tempo, and when its first beat falls (seconds into the recording). */
export interface Beat {
  /** The average tempo. */
  bpm: number
  firstBeatSec: number
  /** Every beat, in seconds into the recording, following the music as it speeds up or slows. */
  times: number[]
}

/** The music's beat, or null when there's no clear one. */
export async function detectBeat(source: AudioSource): Promise<Beat | null> {
  const { envelope, rate, frameSec } = await onsetStrength(source, TEMPO_ANALYSIS_SEC)
  if (envelope.length === 0) return null
  const average = mean(envelope)
  if (average < MIN_ONSET_ENERGY) return null
  const centred = envelope.map((x) => x - average)

  const lagFor = (bpm: number): number => (SEC_PER_MIN * rate) / bpm
  const shortest = Math.floor(lagFor(MAX_BPM))
  const longest = Math.ceil(lagFor(MIN_BPM))
  const ac = (lag: number): number => autocorrelation(centred, lag)
  let coarse = shortest
  let bestScore = -Infinity
  for (let lag = shortest; lag <= longest; lag++) {
    const bpm = (SEC_PER_MIN * rate) / lag
    const preference = Math.exp(-0.5 * (Math.log2(bpm / PREFERRED_BPM) / PREFERENCE_OCTAVES) ** 2)
    const score = ac(lag) * preference
    if (score > bestScore) {
      bestScore = score
      coarse = lag
    }
  }
  if (bestScore <= 0) return null
  const fine = peakNear(ac, coarse * REFINE_BEATS, REFINE_BEATS) / REFINE_BEATS
  const times = trackBeats(envelope, fine).map(frameSec)
  if (times.length === 0) return null
  return { bpm: (SEC_PER_MIN * rate) / fine, firstBeatSec: times[0], times }
}

// How firmly beats keep to the song's tempo: high enough to step over a fill or a
// rest, low enough to follow a band that speeds up or drags.
const BEAT_TIGHTNESS = 400

/**
 * Finds each beat (as an onset-envelope frame): the chain of strong onsets, about a
 * beat apart, that scores best overall. Dynamic programming after Ellis, "Beat
 * Tracking by Dynamic Programming" (2007): https://www.ee.columbia.edu/~dpwe/pubs/Ellis07-beattrack.pdf
 */
function trackBeats(envelope: Float32Array, period: number): number[] {
  const n = envelope.length
  const mean = envelope.reduce((s, x) => s + x, 0) / n
  const spread = Math.sqrt(envelope.reduce((s, x) => s + (x - mean) ** 2, 0) / n) || 1
  // A little smoothing, so a beat a frame early or late still lines up.
  const local = Float64Array.from(envelope, (_, i) => {
    const near = [envelope[i - 1] ?? envelope[i], envelope[i], envelope[i + 1] ?? envelope[i]]
    return (near[0] * 0.25 + near[1] * 0.5 + near[2] * 0.25 - mean) / spread
  })
  const score = new Float64Array(n)
  const from = new Int32Array(n).fill(-1)
  const shortest = Math.round(period / 2)
  const longest = Math.round(period * 2)
  for (let t = 0; t < n; t++) {
    let best = -Infinity
    for (let p = Math.max(0, t - longest); p <= t - shortest; p++) {
      const gap = Math.log((t - p) / period)
      const value = score[p] - BEAT_TIGHTNESS * gap * gap
      if (value > best) {
        best = value
        from[t] = p
      }
    }
    score[t] = local[t] + (best > 0 ? best : 0)
    if (best <= 0) from[t] = -1
  }
  // The last beat is the best-scoring frame within a beat of the end.
  let last = n - 1
  for (let t = Math.max(0, n - Math.round(period)); t < n; t++) if (score[t] > score[last]) last = t
  const beats: number[] = []
  for (let t = last; t >= 0; t = from[t]) beats.unshift(t)
  return beats
}

// --- Speed and pitch -----------------------------------------------------------

// WSOLA: overlapping 50 ms frames, each nudged by up to 10 ms to line up with what
// came before, so beats and notes stay clean at a new speed.
// https://www.researchgate.net/publication/2391829 (Verhelst & Roelands, 1993)
const FRAME_SEC = 0.05
const SEEK_SEC = 0.01
// Lining frames up uses a thinned-out copy: alignment needs the shape, not the detail.
const GUIDE_STEP = 8
const FRAMES_PER_YIELD = 200
const SEMITONES = 12
// Raising the pitch reads the audio faster, which would fold its top octave back
// down as noise; a low-pass just under the new Nyquist stops that.
const ANTI_ALIAS_SHARE = 0.45

/** Changes length by `factor` (2 is twice as long) without changing pitch. */
async function timeStretch(
  channels: Float32Array[],
  sampleRate: number,
  factor: number
): Promise<Float32Array<ArrayBuffer>[]> {
  const length = channels[0]?.length ?? 0
  const frame = 2 * Math.round((FRAME_SEC * sampleRate) / 2)
  const hop = frame / 2
  const analysisHop = hop / factor
  const seek = Math.round(SEEK_SEC * sampleRate)
  const window = Float32Array.from(hann(frame, true))
  // A mono, thinned guide for finding where each frame lines up best.
  const guide = new Float32Array(Math.ceil(length / GUIDE_STEP))
  for (let i = 0; i < guide.length; i++) {
    let sum = 0
    for (const channel of channels) {
      for (let j = 0; j < GUIDE_STEP; j++) sum += channel[i * GUIDE_STEP + j] ?? 0
    }
    guide[i] = sum
  }
  const overlap = Math.round(hop / GUIDE_STEP)
  const reach = Math.round(seek / GUIDE_STEP)
  const similarity = (a: number, b: number): number => {
    let dot = 0
    let energy = 0
    for (let i = 0; i < overlap; i++) {
      const x = guide[b + i] ?? 0
      dot += (guide[a + i] ?? 0) * x
      energy += x * x
    }
    return energy > 0 ? dot / Math.sqrt(energy) : 0
  }

  const outLength = Math.round(length * factor)
  const out = channels.map(() => new Float32Array(outLength + frame))
  let previous = 0
  for (let k = 0; k * hop < outLength; k++) {
    let pos = Math.round(k * analysisHop)
    if (k > 0) {
      // Where the previous frame would naturally carry on; find the nearby frame
      // that sounds most like it.
      const follow = Math.round((previous + hop) / GUIDE_STEP)
      const centre = Math.round(pos / GUIDE_STEP)
      let best = centre
      let bestScore = -Infinity
      for (let c = centre - reach; c <= centre + reach; c++) {
        if (c < 0) continue
        const score = similarity(follow, c)
        if (score > bestScore) {
          bestScore = score
          best = c
        }
      }
      pos = best * GUIDE_STEP
    }
    for (let ch = 0; ch < channels.length; ch++) {
      const src = channels[ch]
      const dst = out[ch]
      const at = k * hop
      for (let i = 0; i < frame && pos + i < length; i++) dst[at + i] += window[i] * src[pos + i]
    }
    previous = pos
    if ((k + 1) % FRAMES_PER_YIELD === 0) await nextTick()
  }
  return out.map((c) => c.slice(0, outLength))
}

/** Reads `x` at `ratio` times the speed (Catmull–Rom interpolation): higher and shorter. */
function resample(x: Float32Array, ratio: number): Float32Array<ArrayBuffer> {
  const out = new Float32Array(Math.round(x.length / ratio))
  const at = (i: number): number => x[clamp(i, 0, x.length - 1)]
  for (let n = 0; n < out.length; n++) {
    const pos = n * ratio
    const i = Math.floor(pos)
    const t = pos - i
    const p0 = at(i - 1)
    const p1 = at(i)
    const p2 = at(i + 1)
    const p3 = at(i + 2)
    out[n] =
      p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)))
  }
  return out
}

/**
 * Music at a new speed (1.1 is 10% faster) and key (+2 is two semitones up), each
 * without changing the other: stretch the length, then resample to move the pitch.
 */
export async function changeSpeedAndPitch(
  channels: Float32Array[],
  sampleRate: number,
  speed: number,
  semitones: number
): Promise<Float32Array<ArrayBuffer>[]> {
  const pitch = 2 ** (semitones / SEMITONES)
  const stretched = await timeStretch(channels, sampleRate, pitch / speed)
  if (pitch === 1) return stretched
  return stretched.map((channel) => {
    if (pitch > 1) lowpass(channel, sampleRate, (ANTI_ALIAS_SHARE * sampleRate) / pitch)
    return resample(channel, pitch)
  })
}

export interface MusicChange {
  speed: number
  semitones: number
}

export const musicKey = ({ speed, semitones }: MusicChange): string =>
  `music:${speed.toFixed(3)}|${semitones}`

/** A copy of some music at a new speed and key (remembered, like tuning). */
export function changeMusicBuffer(buffer: AudioBuffer, change: MusicChange): Promise<AudioBuffer> {
  return cachedRender(buffer, musicKey(change), async () =>
    bufferOf(
      await changeSpeedAndPitch(
        channelsOf(buffer),
        buffer.sampleRate,
        change.speed,
        change.semitones
      ),
      buffer.sampleRate
    )
  )
}

const beats = new WeakMap<AudioBuffer, Promise<Beat | null>>()

/** The beat of a recording as it was made, heard once and remembered. */
export function beatOf(buffer: AudioBuffer): Promise<Beat | null> {
  let beat = beats.get(buffer)
  if (!beat) {
    beat = detectBeat({ channels: channelsOf(buffer), sampleRate: buffer.sampleRate }).catch(
      () => null
    )
    beats.set(buffer, beat)
  }
  return beat
}
