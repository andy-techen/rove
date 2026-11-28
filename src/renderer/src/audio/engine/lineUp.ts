import { onsetStrength } from '../dsp/onsets'
import { AudioSource } from '../dsp/audioSource'
import { parabolicOffset } from '../dsp/peakFit'
import { mean, median } from '../dsp/stats'
import {
  ANALYSIS_SEC,
  EARLIEST_SEC,
  LATEST_SEC,
  MIN_CORRELATION,
  MIN_PROMINENCE
} from './constants'

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

const centred = (x: Float32Array): Float32Array => {
  const average = mean(x)
  return x.map((v) => v - average)
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
  const typical = median(scores)
  if (scores[best] < MIN_CORRELATION || scores[best] - typical < MIN_PROMINENCE) return null

  // A parabola through the peak and its neighbours places it between frames.
  const [a, b, c] = [scores[best - 1], scores[best], scores[best + 1]]
  const between = a !== undefined && c !== undefined ? parabolicOffset(a, b, c, 'peak') : 0
  return (first + best + between) / voice.rate
}
