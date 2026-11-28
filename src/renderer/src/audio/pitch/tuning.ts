import { nearestNote } from './key'
import { PitchTrack, analysePitch, hzToMidi } from './pitch'
import { bufferOf, cachedRender, channelsOf } from '../dsp/renderCache'
import { hann } from '../dsp/fft'
import { clamp } from '../dsp/units'
import { MAX_CORRECTION_SEMITONES, HYSTERESIS_SEMITONES, GRAIN_HOP_SEC } from './constants'
import { SEMITONES_PER_OCTAVE } from '@shared/units'

/** How hard and how fast to pull notes in tune, and which notes count as in tune. */
export interface Tuning {
  /** 0 leaves the voice alone, 1 lands exactly on the note. */
  strength: number
  /** How long a correction takes to settle; 0 is instant ("snappy"). */
  retuneSec: number
  /** Allowed pitch classes (0 = C). */
  scale: readonly number[]
}

/**
 * How much to scale the pitch at each hop of a pitch track: 1 leaves it, 2^(1/12)
 * raises it a semitone. Unpitched sounds (breaths, consonants) are left alone.
 */
export function correctionRatios(track: PitchTrack, tuning: Tuning): Float32Array {
  const ratios = new Float32Array(track.f0.length).fill(1)
  if (tuning.strength <= 0) return ratios
  // One-pole smoothing: covers ~63% of the way to a new correction per `retuneSec`.
  const follow = tuning.retuneSec > 0 ? 1 - Math.exp(-track.hopSec / tuning.retuneSec) : 1
  let target: number | null = null
  let correction = 0
  for (let i = 0; i < track.f0.length; i++) {
    const hz = track.f0[i]
    let wanted = 0
    if (hz > 0) {
      const sung = hzToMidi(hz)
      const nearest = nearestNote(sung, tuning.scale)
      if (
        target === null ||
        Math.abs(sung - target) > Math.abs(sung - nearest) + HYSTERESIS_SEMITONES
      ) {
        target = nearest
      }
      wanted = Math.max(
        -MAX_CORRECTION_SEMITONES,
        Math.min(MAX_CORRECTION_SEMITONES, (target - sung) * tuning.strength)
      )
    } else {
      target = null
    }
    correction += follow * (wanted - correction)
    ratios[i] = 2 ** (correction / SEMITONES_PER_OCTAVE)
  }
  return ratios
}

/**
 * Re-pitches a take, keeping its timing: overlapping grains each read the original a
 * little faster or slower. Where the voice has a pitch, each grain's read position
 * is kept a whole number of periods from its neighbour's, so grains line up in phase
 * instead of smearing (the idea behind PSOLA). With every ratio at 1 the take comes
 * back sample for sample.
 */
export function shiftPitch(
  input: Float32Array,
  sampleRate: number,
  hopSec: number,
  ratios: Float32Array,
  f0: Float32Array
): Float32Array<ArrayBuffer> {
  const out = new Float32Array(input.length)
  const hop = Math.max(1, Math.round(GRAIN_HOP_SEC * sampleRate))
  const grain = hop * 2
  const window = Float32Array.from(hann(grain, true))
  const frameAt = (n: number): number =>
    clamp(Math.round(n / sampleRate / hopSec), 0, ratios.length - 1)
  const sample = (pos: number): number => {
    const i = Math.floor(pos)
    if (i < 0 || i >= input.length) return 0
    const next = i + 1 < input.length ? input[i + 1] : 0
    return input[i] + (next - input[i]) * (pos - i)
  }

  let anchor = 0
  let previousRatio = 1
  for (let centre = 0; centre - hop < input.length; centre += hop) {
    const frame = frameAt(centre)
    const ratio = ratios[frame] ?? 1
    const period = f0[frame] > 0 ? sampleRate / f0[frame] : 0
    if (centre > 0) anchor += (hop * (ratio + previousRatio)) / 2
    // Stay within half a period of where this grain belongs, moving by whole periods.
    anchor = period > 0 ? anchor - Math.round((anchor - centre) / period) * period : centre
    previousRatio = ratio
    for (let k = 0; k < grain; k++) {
      const n = centre - hop + k
      if (n < 0 || n >= out.length) continue
      out[n] += window[k] * sample(anchor + (n - centre) * ratio)
    }
  }
  return out
}

// --- Tuned copies of takes.

const pitchTracks = new WeakMap<AudioBuffer, Promise<PitchTrack>>()

export const tuningKey = (tuning: Tuning): string =>
  `tuning:${tuning.strength.toFixed(3)}|${tuning.retuneSec.toFixed(3)}|${tuning.scale.join(',')}`

/** The sung pitch of a take, measured once and remembered. */
function pitchOf(buffer: AudioBuffer): Promise<PitchTrack> {
  let track = pitchTracks.get(buffer)
  if (!track) {
    track = analysePitch(buffer.getChannelData(0), buffer.sampleRate)
    pitchTracks.set(buffer, track)
  }
  return track
}

/** A tuned copy of a take. Every channel follows the pitch of the first. */
export function tuneBuffer(buffer: AudioBuffer, tuning: Tuning): Promise<AudioBuffer> {
  return cachedRender(buffer, tuningKey(tuning), async () => {
    const track = await pitchOf(buffer)
    const ratios = correctionRatios(track, tuning)
    const shifted = channelsOf(buffer).map((channel) =>
      shiftPitch(channel, buffer.sampleRate, track.hopSec, ratios, track.f0)
    )
    return bufferOf(shifted, buffer.sampleRate)
  })
}
