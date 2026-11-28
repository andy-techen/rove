import { parabolicOffset } from '../dsp/peakFit'
import {
  MIN_LINE_UP_SEC,
  FRAME_SEC,
  PAUSE_BELOW_LOUD_DB,
  LOUD_PERCENTILE,
  FLOOR_DB,
  MIN_PAUSE_SEC,
  MIN_PHRASE_SEC,
  MAX_SHIFT_SEC,
  MIN_MATCH
} from './constants'

/** A stretch of singing between pauses, in seconds from the start of the take. */
export interface Phrase {
  from: number
  to: number
}

/** A harmony phrase, and how late it sits behind the lead (negative when early; 0 to leave it). */
export interface PhraseTiming extends Phrase {
  bySec: number
}

/** How loud each frame is, in dB. */
function levels(samples: Float32Array, sampleRate: number): Float32Array {
  const size = Math.max(1, Math.round(FRAME_SEC * sampleRate))
  const out = new Float32Array(Math.floor(samples.length / size))
  for (let f = 0; f < out.length; f++) {
    let sum = 0
    for (let i = f * size; i < (f + 1) * size; i++) sum += samples[i] * samples[i]
    out[f] = Math.max(FLOOR_DB, 10 * Math.log10(sum / size + Number.MIN_VALUE))
  }
  return out
}

function phraseFrames(db: Float32Array): [number, number][] {
  const sorted = Float32Array.from(db).sort()
  const loud = sorted[Math.floor((sorted.length - 1) * LOUD_PERCENTILE)] ?? FLOOR_DB
  const threshold = Math.max(FLOOR_DB, loud - PAUSE_BELOW_LOUD_DB)
  const minPause = Math.round(MIN_PAUSE_SEC / FRAME_SEC)
  const runs: [number, number][] = []
  for (let f = 0; f < db.length; f++) {
    if (db[f] <= threshold || loud <= FLOOR_DB) continue
    const last = runs[runs.length - 1]
    if (last && f - last[1] < minPause) last[1] = f + 1
    else runs.push([f, f + 1])
  }
  return runs.filter(([a, b]) => (b - a) * FRAME_SEC >= MIN_PHRASE_SEC)
}

/** The phrases sung in a take, split where the singer pauses. */
export function phrasesOf(samples: Float32Array, sampleRate: number): Phrase[] {
  return phraseFrames(levels(samples, sampleRate)).map(([a, b]) => ({
    from: a * FRAME_SEC,
    to: b * FRAME_SEC
  }))
}

/** Pearson correlation of two equal-length runs; 0 when either is flat. */
function correlation(a: Float32Array, b: Float32Array): number {
  const n = a.length
  let ma = 0
  let mb = 0
  for (let i = 0; i < n; i++) {
    ma += a[i]
    mb += b[i]
  }
  ma /= n
  mb /= n
  let ab = 0
  let aa = 0
  let bb = 0
  for (let i = 0; i < n; i++) {
    ab += (a[i] - ma) * (b[i] - mb)
    aa += (a[i] - ma) ** 2
    bb += (b[i] - mb) ** 2
  }
  return aa > 0 && bb > 0 ? ab / Math.sqrt(aa * bb) : 0
}

/** `db` from `from` for `length` frames, with silence where it runs off either end. */
function window(db: Float32Array, from: number, length: number): Float32Array {
  const out = new Float32Array(length).fill(FLOOR_DB)
  for (let i = Math.max(0, -from); i < length && from + i < db.length; i++) out[i] = db[from + i]
  return out
}

/**
 * How far each phrase of a harmony sits from the lead sung under it, found by matching
 * how the voices rise and fall through the words (the notes differ; the words don't).
 * `harmony` and `lead` start at the same moment. A phrase Rove can't match clearly, or
 * one already with the lead, gets 0. Null when no phrase needs moving.
 */
export function harmonyTiming(
  harmony: Float32Array,
  lead: Float32Array,
  sampleRate: number
): PhraseTiming[] | null {
  const h = levels(harmony, sampleRate)
  const l = levels(lead, sampleRate)
  const reach = Math.round(MAX_SHIFT_SEC / FRAME_SEC)
  // Half a pause either side: where the phrase starts and stops matters most.
  const edge = Math.round(MIN_PAUSE_SEC / 2 / FRAME_SEC)
  const timing = phraseFrames(h).map(([a, b]): PhraseTiming => {
    const from = a - edge
    const length = b - a + 2 * edge
    const sung = window(h, from, length)
    // score(lag): how well the harmony matches the lead heard `lag` frames later.
    const scores: number[] = []
    for (let lag = -reach; lag <= reach; lag++) {
      scores.push(correlation(sung, window(l, from - lag, length)))
    }
    const best = scores.indexOf(Math.max(...scores))
    const phrase = { from: a * FRAME_SEC, to: b * FRAME_SEC }
    // Best at the edge of the search means the real match lies further out, or nowhere.
    const atEdge = best === 0 || best === scores.length - 1
    if (scores[best] < MIN_MATCH || atEdge) return { ...phrase, bySec: 0 }
    // A parabola through the peak and its neighbours places it between frames.
    const [p, q, r] = [scores[best - 1], scores[best], scores[best + 1]]
    const between = p !== undefined && r !== undefined ? parabolicOffset(p, q, r, 'peak') : 0
    const bySec = (best - reach + between) * FRAME_SEC
    return { ...phrase, bySec: Math.abs(bySec) >= MIN_LINE_UP_SEC ? bySec : 0 }
  })
  return timing.some((p) => p.bySec !== 0) ? timing : null
}
