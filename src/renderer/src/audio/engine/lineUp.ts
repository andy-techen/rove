import { onsetStrength } from '../dsp/onsets'
import { AudioSource } from '../pitch/key'

/** A piece of music as it plays on the timeline (a backing clip, the chords). */
export interface MusicClip {
  buffer: Pick<AudioBuffer, 'numberOfChannels' | 'sampleRate' | 'getChannelData'>
  start: number
  offset: number
  duration: number
}

/** The music sounding from `fromSec` for `length` samples, mixed to mono at `sampleRate`. */
export function musicUnder(
  clips: MusicClip[],
  fromSec: number,
  length: number,
  sampleRate: number
): Float32Array<ArrayBuffer> {
  const out = new Float32Array(length)
  for (const clip of clips) {
    const { buffer } = clip
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, c) =>
      buffer.getChannelData(c)
    )
    const first = Math.max(0, Math.ceil((clip.start - fromSec) * sampleRate))
    const last = Math.min(length, Math.floor((clip.start + clip.duration - fromSec) * sampleRate))
    for (let i = first; i < last; i++) {
      const at = Math.floor(
        (fromSec + i / sampleRate - clip.start + clip.offset) * buffer.sampleRate
      )
      for (const channel of channels) out[i] += (channel[at] ?? 0) / channels.length
    }
  }
  return out
}

// A take's first minute and a half is plenty: the delay stays the same all the way.
const ANALYSIS_SEC = 90
// How far to look. Singers are rarely early by much; a late take can be late by a
// Bluetooth headphone's quarter second. Wider would start matching the beat before.
const EARLIEST_SEC = -0.1
const LATEST_SEC = 0.3
// How clearly the voice's starts must follow the music's at the best lag, as a
// correlation, and how far that must stand above the typical lag's. Measured on real
// takes: a take 140 ms late scored 0.2 against a typical 0.06.
const MIN_CORRELATION = 0.1
const MIN_PROMINENCE = 0.05
/** Below this, a take is in time: too little to hear, so nothing is offered. */
export const MIN_LINE_UP_SEC = 0.02

const centred = (x: Float32Array): Float32Array => {
  const mean = x.reduce((s, v) => s + v, 0) / (x.length || 1)
  return x.map((v) => v - mean)
}
const deviation = (x: Float32Array): number =>
  Math.sqrt(x.reduce((s, v) => s + v * v, 0) / (x.length || 1))

/**
 * How late the singing sits against the music it was sung to, in seconds (negative when
 * early), found by matching where notes and words start against where the music's
 * hits do. Null when the match isn't clear enough to trust.
 */
export async function takeLag(take: AudioSource, music: AudioSource): Promise<number | null> {
  const voice = await onsetStrength(take, ANALYSIS_SEC)
  const band = await onsetStrength(music, ANALYSIS_SEC)
  const n = Math.min(voice.envelope.length, band.envelope.length)
  const v = centred(voice.envelope.subarray(0, n))
  const m = centred(band.envelope.subarray(0, n))
  const scale = deviation(v) * deviation(m)
  if (n === 0 || scale === 0) return null

  // score(lag): how well the voice matches the music when heard `lag` frames later.
  const score = (lag: number): number => {
    let sum = 0
    for (let i = Math.max(0, lag); i < n + Math.min(0, lag); i++) sum += v[i] * m[i - lag]
    return sum / ((n - Math.abs(lag)) * scale)
  }
  const first = Math.round(EARLIEST_SEC * voice.rate)
  const last = Math.round(LATEST_SEC * voice.rate)
  const scores: number[] = []
  for (let lag = first; lag <= last; lag++) scores.push(score(lag))
  const best = scores.indexOf(Math.max(...scores))
  const typical = [...scores].sort((a, b) => a - b)[Math.floor(scores.length / 2)]
  if (scores[best] < MIN_CORRELATION || scores[best] - typical < MIN_PROMINENCE) return null

  // A parabola through the peak and its neighbours places it between frames.
  const [a, b, c] = [scores[best - 1], scores[best], scores[best + 1]]
  const bend = a - 2 * b + c
  const between = a !== undefined && c !== undefined && bend < 0 ? (a - c) / (2 * bend) : 0
  return (first + best + between) / voice.rate
}
