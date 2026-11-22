import { downsampleForAnalysis, nextTick } from './resample'
import { dbToGain } from './units'

/** How often the sung pitch is measured. */
export const PITCH_HOP_SEC = 0.01

/** The sung pitch over a take: one value per hop, in hertz, 0 where nothing is sung. */
export interface PitchTrack {
  hopSec: number
  f0: Float32Array
}

// The range of singing voices, from a low bass to a high soprano.
const MIN_F0_HZ = 70
const MAX_F0_HZ = 1100
// Harmonics above this don't help find the fundamental.
const ANALYSIS_CUTOFF_HZ = 2000
// Long enough to hold a couple of periods of the lowest note.
const WINDOW_SEC = 0.025
// YIN's aperiodicity threshold: below it, a lag counts as the period. 0.1–0.2 is
// usual; higher accepts breathier voices at the risk of octave mistakes.
// http://audition.ens.fr/adc/pdf/2002_JASA_YIN.pdf
const YIN_THRESHOLD = 0.15
// Quieter than this is room noise, not singing.
const SILENCE_DB = -50
const FRAMES_PER_CHUNK = 500

const A4_HZ = 440
const A4_MIDI = 69
const SEMITONES = 12

export const hzToMidi = (hz: number): number => A4_MIDI + SEMITONES * Math.log2(hz / A4_HZ)
export const midiToHz = (midi: number): number => A4_HZ * 2 ** ((midi - A4_MIDI) / SEMITONES)

/**
 * YIN pitch of the window starting at `start`: the period as a fractional lag in
 * samples, or 0 when the sound has no clear pitch. `diff` is scratch space.
 */
function yinLag(
  x: Float32Array,
  start: number,
  window: number,
  minLag: number,
  maxLag: number,
  diff: Float64Array
): number {
  let energy = 0
  for (let j = 0; j < window; j++) energy += x[start + j] * x[start + j]
  if (Math.sqrt(energy / window) < dbToGain(SILENCE_DB)) return 0

  // Cumulative mean normalised difference, d'(τ).
  let running = 0
  diff[0] = 1
  for (let lag = 1; lag <= maxLag; lag++) {
    let sum = 0
    for (let j = 0; j < window; j++) {
      const d = x[start + j] - x[start + j + lag]
      sum += d * d
    }
    running += sum
    diff[lag] = running > 0 ? (sum * lag) / running : 1
  }
  for (let lag = minLag; lag < maxLag; lag++) {
    if (diff[lag] >= YIN_THRESHOLD) continue
    while (lag + 1 < maxLag && diff[lag + 1] < diff[lag]) lag++
    // A parabola through the dip and its neighbours finds the period between samples.
    const a = diff[lag - 1]
    const b = diff[lag]
    const c = diff[lag + 1]
    const bend = a - 2 * b + c
    return bend > 0 ? lag + (a - c) / (2 * bend) : lag
  }
  return 0
}

/** Removes one-hop glitches (an octave jump, a dropout) inside a sung note. */
function smoothGlitches(f0: Float32Array): Float32Array {
  const out = f0.slice()
  for (let i = 1; i < f0.length - 1; i++) {
    if (!f0[i - 1] || !f0[i + 1]) continue
    const [, middle] = [f0[i - 1], f0[i], f0[i + 1]].sort((a, b) => a - b)
    out[i] = middle
  }
  return out
}

/**
 * Measures the sung pitch through a take. Runs in chunks, yielding between them, so a
 * long take doesn't freeze the window.
 */
export async function analysePitch(samples: Float32Array, sampleRate: number): Promise<PitchTrack> {
  const { data, rate } = downsampleForAnalysis([samples], sampleRate, ANALYSIS_CUTOFF_HZ)
  const window = Math.round(WINDOW_SEC * rate)
  const minLag = Math.floor(rate / MAX_F0_HZ)
  const maxLag = Math.ceil(rate / MIN_F0_HZ)
  const span = window + maxLag + 1
  const diff = new Float64Array(maxLag + 1)
  const frames = Math.floor(samples.length / sampleRate / PITCH_HOP_SEC) + 1
  const f0 = new Float32Array(frames)
  for (let i = 0; i < frames; i++) {
    // Each window is centred on its hop's time.
    const start = Math.round(i * PITCH_HOP_SEC * rate) - Math.floor(span / 2)
    if (start >= 0 && start + span <= data.length) {
      const lag = yinLag(data, start, window, minLag, maxLag, diff)
      f0[i] = lag > 0 ? rate / lag : 0
    }
    if ((i + 1) % FRAMES_PER_CHUNK === 0) await nextTick()
  }
  return { hopSec: PITCH_HOP_SEC, f0: smoothGlitches(f0) }
}
