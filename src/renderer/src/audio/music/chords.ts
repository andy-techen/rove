import { fft } from '../dsp/fft'
import { channelsOf } from '../dsp/renderCache'
import { beatOf } from './stretch'
import { AudioSource, PITCH_CLASSES } from '../pitch/key'
import { hzToMidi } from '../pitch/pitch'
import { downsampleForAnalysis, nextTick } from '../dsp/resample'
import { dbToGain } from '../dsp/units'

/** The kinds of chord a chart can hold, in the order the chord picker lists them. */
export const CHORD_QUALITIES = ['major', 'minor', '7', 'maj7', 'm7', 'sus2', 'sus4', 'dim'] as const
export type ChordQuality = (typeof CHORD_QUALITIES)[number]

/** A chord by its root (pitch class, 0 = C) and quality. */
export interface Chord {
  root: number
  quality: ChordQuality
  /** A slash chord's bass note (pitch class), when it isn't the root: "C/E". */
  bass?: number
}

/** Each kind of chord's notes, in semitones above its root. */
export const CHORD_TONES: Record<ChordQuality, number[]> = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  '7': [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  dim: [0, 3, 6]
}

/** A stretch of a recording and the chord heard in it (null: no chord, or silence). */
export interface ChordSegment {
  start: number
  end: number
  chord: Chord | null
}

// Chords live in the bass and middle; above this is mostly cymbals and breath.
const CUTOFF_HZ = 2000
const LOW_HZ = 60
const FFT_SIZE = 4096
const HOP = 1024
// Without a beat to follow, chords are judged half a second at a time.
const BLOCK_SEC = 0.5
// Quieter than this, there's nothing to name.
const SILENCE_DB = -50
// What it costs to change chord between blocks: enough to stop a passing note
// flipping the name back and forth, small enough to follow real changes.
const CHANGE_COST = 0.12
// How well a block must fit some chord to be named at all.
const NO_CHORD_SCORE = 0.55
const FRAMES_PER_CHUNK = 200

const CHORDS: Chord[] = (['major', 'minor'] as const).flatMap((quality) =>
  Array.from({ length: PITCH_CLASSES }, (_, root) => ({ root, quality }))
)

/** A chord's notes as a unit-length pitch-class vector. */
const TEMPLATES = CHORDS.map(({ root, quality }) => {
  const v = new Array<number>(PITCH_CLASSES).fill(0)
  for (const step of CHORD_TONES[quality]) v[(root + step) % PITCH_CLASSES] = 1
  const norm = Math.sqrt(CHORD_TONES[quality].length)
  return v.map((x) => x / norm)
})

/** How strongly each pitch class sounds in each analysis frame, and when each frame is. */
async function chromagram(
  source: AudioSource
): Promise<{ frames: Float64Array[]; times: number[]; levels: number[] }> {
  const { data, rate } = downsampleForAnalysis(source.channels, source.sampleRate, CUTOFF_HZ)
  const hann = Float64Array.from(
    { length: FFT_SIZE },
    (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / FFT_SIZE)
  )
  const lowBin = Math.ceil((LOW_HZ * FFT_SIZE) / rate)
  const highBin = Math.floor((CUTOFF_HZ * FFT_SIZE) / rate)
  const pcOfBin = Array.from({ length: highBin + 1 }, (_, bin) =>
    bin >= lowBin
      ? ((Math.round(hzToMidi((bin * rate) / FFT_SIZE)) % PITCH_CLASSES) + PITCH_CLASSES) %
        PITCH_CLASSES
      : -1
  )
  const re = new Float64Array(FFT_SIZE)
  const im = new Float64Array(FFT_SIZE)
  const frames: Float64Array[] = []
  const times: number[] = []
  const levels: number[] = []
  for (let start = 0, f = 0; start + FFT_SIZE <= data.length; start += HOP, f++) {
    let energy = 0
    for (let i = 0; i < FFT_SIZE; i++) {
      re[i] = data[start + i] * hann[i]
      energy += data[start + i] * data[start + i]
    }
    im.fill(0)
    fft(re, im)
    const chroma = new Float64Array(PITCH_CLASSES)
    for (let bin = lowBin; bin <= highBin; bin++) {
      chroma[pcOfBin[bin]] += Math.hypot(re[bin], im[bin])
    }
    frames.push(chroma)
    times.push((start + FFT_SIZE / 2) / rate)
    levels.push(Math.sqrt(energy / FFT_SIZE))
    if ((f + 1) % FRAMES_PER_CHUNK === 0) await nextTick()
  }
  return { frames, times, levels }
}

/** The block boundaries: the beats when known, else every half second. */
function blockEdges(durationSec: number, beatTimes?: number[]): number[] {
  const edges =
    beatTimes && beatTimes.length > 1
      ? beatTimes.filter((t) => t > 0 && t < durationSec)
      : Array.from({ length: Math.floor(durationSec / BLOCK_SEC) }, (_, i) => (i + 1) * BLOCK_SEC)
  return [0, ...edges, durationSec]
}

/**
 * The chords through some music, one name per beat (or half second), smoothed so the
 * name only changes when the harmony really does. Major and minor chords only: what a
 * beginner's chord sheet shows.
 */
export async function detectChords(
  source: AudioSource,
  beatTimes?: number[]
): Promise<ChordSegment[]> {
  const duration = (source.channels[0]?.length ?? 0) / source.sampleRate
  const { frames, times, levels } = await chromagram(source)
  const edges = blockEdges(duration, beatTimes)
  const silence = dbToGain(SILENCE_DB)

  // Each block's chroma, summed over its frames: null for silence, 'unheard' for a
  // sliver too short to hold a frame (the very end), which just carries on the chord.
  const blocks = edges.slice(0, -1).map((from, b) => {
    const to = edges[b + 1]
    const sum = new Float64Array(PITCH_CLASSES)
    let loud = 0
    let count = 0
    times.forEach((t, f) => {
      if (t < from || t >= to) return
      count++
      loud += levels[f]
      for (let pc = 0; pc < PITCH_CLASSES; pc++) sum[pc] += frames[f][pc]
    })
    if (count === 0) return 'unheard' as const
    if (loud / count < silence) return null
    const norm = Math.hypot(...sum)
    return norm > 0 ? Array.from(sum, (x) => x / norm) : null
  })

  // Viterbi over chords plus "no chord" (the last state): best fit, few changes.
  const states = CHORDS.length + 1
  const fit = (block: number[] | null | 'unheard', s: number): number => {
    if (block === 'unheard') return 0
    if (!block) return s === CHORDS.length ? 1 : 0
    if (s === CHORDS.length) return NO_CHORD_SCORE
    return TEMPLATES[s].reduce((acc, w, pc) => acc + w * block[pc], 0)
  }
  let score = Array.from({ length: states }, (_, s) => fit(blocks[0] ?? null, s))
  const from: number[][] = []
  for (let b = 1; b < blocks.length; b++) {
    const best = Math.max(...score)
    const bestState = score.indexOf(best)
    const back: number[] = []
    score = score.map((stay, s) => {
      const change = best - CHANGE_COST
      back.push(stay >= change ? s : bestState)
      return Math.max(stay, change) + fit(blocks[b], s)
    })
    from.push(back)
  }
  const path = [score.indexOf(Math.max(...score))]
  for (let b = from.length - 1; b >= 0; b--) path.unshift(from[b][path[0]])

  const segments: ChordSegment[] = []
  path.forEach((s, b) => {
    const chord = s === CHORDS.length ? null : CHORDS[s]
    const last = segments.at(-1)
    const same =
      last &&
      (last.chord === chord ||
        (last.chord &&
          chord &&
          last.chord.root === chord.root &&
          last.chord.quality === chord.quality))
    if (same) last.end = edges[b + 1]
    else segments.push({ start: edges[b], end: edges[b + 1], chord })
  })
  return segments
}

const heard = new WeakMap<AudioBuffer, Promise<ChordSegment[]>>()

/** The chords of a recording as it was made, heard once (beat by beat) and remembered. */
export function chordsOf(buffer: AudioBuffer): Promise<ChordSegment[]> {
  let chords = heard.get(buffer)
  if (!chords) {
    chords = beatOf(buffer).then((beat) =>
      detectChords({ channels: channelsOf(buffer), sampleRate: buffer.sampleRate }, beat?.times)
    )
    heard.set(
      buffer,
      chords.catch(() => [])
    )
  }
  return heard.get(buffer)!
}
