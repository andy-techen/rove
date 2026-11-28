import { fft, hann as hannWindow } from '../dsp/fft'
import { hzToMidi } from './pitch'
import { downsampleForAnalysis, nextTick } from '../dsp/resample'
import { AudioSource } from '../dsp/audioSource'
import { mean } from '../dsp/stats'

export type KeyMode = 'major' | 'minor'

/** A song's key. `tonic` is a pitch class: 0 is C, 1 is C♯, … 11 is B. */
export interface SongKey {
  tonic: number
  mode: KeyMode
}

export const PITCH_CLASSES = 12
export const KEY_MODES: KeyMode[] = ['major', 'minor']

const SCALE_STEPS: Record<KeyMode, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  // Natural minor.
  minor: [0, 2, 3, 5, 7, 8, 10]
}

export const pitchClass = (note: number): number =>
  ((Math.round(note) % PITCH_CLASSES) + PITCH_CLASSES) % PITCH_CLASSES

/** The pitch classes a key allows, ascending. No key means every note is allowed. */
export function scaleOf(key: SongKey | null | undefined): number[] {
  if (!key) return Array.from({ length: PITCH_CLASSES }, (_, i) => i)
  return SCALE_STEPS[key.mode]
    .map((step) => (key.tonic + step) % PITCH_CLASSES)
    .sort((a, b) => a - b)
}

/** The same key moved up (or down) by some semitones. */
export function transposeKey(key: SongKey, semitones: number): SongKey {
  return {
    ...key,
    tonic: (((key.tonic + semitones) % PITCH_CLASSES) + PITCH_CLASSES) % PITCH_CLASSES
  }
}

/** The nearest whole note (MIDI number) to `midi` whose pitch class is in `scale`. */
export function nearestNote(midi: number, scale: readonly number[]): number {
  let best = Math.round(midi)
  let bestDistance = Infinity
  for (
    let note = Math.floor(midi) - PITCH_CLASSES;
    note <= Math.ceil(midi) + PITCH_CLASSES;
    note++
  ) {
    const distance = Math.abs(note - midi)
    if (distance < bestDistance && scale.includes(pitchClass(note))) {
      best = note
      bestDistance = distance
    }
  }
  return best
}

// Krumhansl–Kessler key profiles: how strongly each scale degree suggests a key.
// https://rnhart.net/articles/key-finding/
const PROFILES: Record<KeyMode, number[]> = {
  major: [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88],
  minor: [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
}

function correlation(a: number[], b: number[]): number {
  const ma = mean(a)
  const mb = mean(b)
  let num = 0
  let da = 0
  let db = 0
  for (let i = 0; i < a.length; i++) {
    num += (a[i] - ma) * (b[i] - mb)
    da += (a[i] - ma) ** 2
    db += (b[i] - mb) ** 2
  }
  return da > 0 && db > 0 ? num / Math.sqrt(da * db) : 0
}

/** The key whose profile best matches how much each pitch class sounds; null if nothing does. */
export function keyFromChroma(chroma: number[]): SongKey | null {
  let best: SongKey | null = null
  let bestScore = -Infinity
  for (const mode of KEY_MODES) {
    for (let tonic = 0; tonic < PITCH_CLASSES; tonic++) {
      const profile = chroma.map(
        (_, pc) => PROFILES[mode][(pc - tonic + PITCH_CLASSES) % PITCH_CLASSES]
      )
      const score = correlation(chroma, profile)
      if (score > bestScore) {
        bestScore = score
        best = { tonic, mode }
      }
    }
  }
  return bestScore > 0 ? best : null
}

// Notes below and above this range are mostly drums, rumble and hiss.
const CHROMA_MIN_HZ = 80
const CHROMA_MAX_HZ = 2000
// ~0.34 s at the analysis rate: fine enough to tell neighbouring low notes apart.
const FFT_SIZE = 4096
const FRAMES_PER_CHUNK = 20

/** Adds up how strongly each pitch class sounds through some audio. */
async function addChroma(source: AudioSource, chroma: number[]): Promise<void> {
  const { data, rate } = downsampleForAnalysis(source.channels, source.sampleRate, CHROMA_MAX_HZ)
  const re = new Float64Array(FFT_SIZE)
  const im = new Float64Array(FFT_SIZE)
  const hann = hannWindow(FFT_SIZE, true)
  const lowBin = Math.ceil((CHROMA_MIN_HZ * FFT_SIZE) / rate)
  const highBin = Math.floor((CHROMA_MAX_HZ * FFT_SIZE) / rate)
  let frame = 0
  for (let start = 0; start + FFT_SIZE <= data.length; start += FFT_SIZE) {
    for (let i = 0; i < FFT_SIZE; i++) re[i] = data[start + i] * hann[i]
    im.fill(0)
    fft(re, im)
    for (let bin = lowBin; bin <= highBin; bin++) {
      chroma[pitchClass(hzToMidi((bin * rate) / FFT_SIZE))] += Math.hypot(re[bin], im[bin])
    }
    if (++frame % FRAMES_PER_CHUNK === 0) await nextTick()
  }
}

// Less total energy than this across a song means there's nothing to hear a key in.
const MIN_CHROMA = 1e-3

/** Listens to some audio (the music, or the vocals if there's no music) and names its key. */
export async function detectKey(sources: AudioSource[]): Promise<SongKey | null> {
  const chroma = new Array<number>(PITCH_CLASSES).fill(0)
  for (const source of sources) await addChroma(source, chroma)
  if (chroma.reduce((s, x) => s + x, 0) < MIN_CHROMA) return null
  return keyFromChroma(chroma)
}
