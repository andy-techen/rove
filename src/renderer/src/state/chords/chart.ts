import { Chord, ChordSegment } from '../../audio/music/chords'
import { PITCH_CLASSES } from '../../audio/pitch/key'
import { ClickGrid } from '../transport/metronome'
import { ChordChart, Project, musicOf } from '../song/project'
import { sameChord } from './chordText'

const SEC_PER_MIN = 60
// Times are rounded so bars that meet share an edge exactly.
const PRECISION = 1e6
const tidy = (sec: number): number => Math.round(sec * PRECISION) / PRECISION

/** The chords track's sound, rendered: it plays from `start` on the timeline. */
export interface ChordPart {
  trackId: string
  buffer: AudioBuffer
  start: number
}

/** The chart laid out on the timeline, at the music's speed and key. */
export interface ChartTimeline {
  /** Every beat, in timeline seconds; the first beat of each bar is a downbeat. */
  beats: { time: number; downbeat: boolean }[]
  /** The chords as they play, a change at a time (null before the first chord). */
  chords: ChordSegment[]
  secPerBeat: number
  beatsPerBar: number
  startSec: number
  endSec: number
}

const shift = (pitch: number, semitones: number): number =>
  (((pitch + semitones) % PITCH_CLASSES) + PITCH_CLASSES) % PITCH_CLASSES

/** A chord moved by the Key knob. */
export function transposeChord(chord: Chord, semitones: number): Chord {
  if (!semitones) return chord
  const moved: Chord = { ...chord, root: shift(chord.root, semitones) }
  if (chord.bass !== undefined) moved.bass = shift(chord.bass, semitones)
  return moved
}

/**
 * Where the chart's bars, beats and chords fall on the timeline. Speed scales it like a
 * music clip (so a chart lined up with a recording stays lined up), and Key moves every
 * chord. Null without a chart or without any bars.
 */
export function chartTimeline(
  project: Project,
  chart: ChordChart | undefined | null
): ChartTimeline | null {
  if (!chart || chart.bars.length === 0) return null
  const { speed, semitones } = musicOf(project)
  const secPerBeat = SEC_PER_MIN / (chart.bpm * speed)
  const barSec = secPerBeat * chart.beatsPerBar
  const startSec = chart.startSec / speed
  const chords: ChordSegment[] = []
  chart.bars.forEach((bar, b) => {
    const barStart = startSec + b * barSec
    const barEnd = tidy(barStart + barSec)
    if (bar.length === 0) {
      // An empty bar carries the last chord on (or the silence before the first one).
      const last = chords.at(-1)
      if (last) last.end = barEnd
      else chords.push({ start: tidy(barStart), end: barEnd, chord: null })
      return
    }
    bar.forEach((written, i) => {
      const chord = transposeChord(written, semitones)
      const start = tidy(barStart + (i * barSec) / bar.length)
      const end = tidy(barStart + ((i + 1) * barSec) / bar.length)
      const last = chords.at(-1)
      if (last && sameChord(last.chord, chord)) last.end = end
      else chords.push({ start, end, chord })
    })
  })
  const beatCount = chart.bars.length * chart.beatsPerBar
  return {
    beats: Array.from({ length: beatCount }, (_, k) => ({
      time: tidy(startSec + k * secPerBeat),
      downbeat: k % chart.beatsPerBar === 0
    })),
    chords,
    secPerBeat,
    beatsPerBar: chart.beatsPerBar,
    startSec: tidy(startSec),
    endSec: tidy(startSec + chart.bars.length * barSec)
  }
}

/** A spot in a chart: a bar, and which of its chords (0, or 1 for a split bar's second). */
export interface ChartPlace {
  bar: number
  slot: number
}

// Absorbs rounding in times, so a chord starting exactly on a bar line lands in that bar.
const EDGE_SEC = 1e-6

/** Which bar, and which half of it, plays at `sec`; null outside the chart. */
export function placeAt(
  timeline: ChartTimeline,
  bars: unknown[][],
  sec: number
): ChartPlace | null {
  if (sec < timeline.startSec - EDGE_SEC || sec >= timeline.endSec - EDGE_SEC) return null
  const barSec = timeline.secPerBeat * timeline.beatsPerBar
  const inBars = (sec - timeline.startSec + EDGE_SEC) / barSec
  const bar = Math.floor(inBars)
  const count = Math.max(1, bars[bar]?.length ?? 1)
  return { bar, slot: Math.min(count - 1, Math.floor((inBars - bar) * count)) }
}

/** The metronome for a chart: every beat, with real bar ones. */
export function chartClickGrid(timeline: ChartTimeline): ClickGrid {
  return {
    clicks: timeline.beats.map((b) => ({ time: b.time, accent: b.downbeat })),
    periodSec: timeline.secPerBeat,
    fromSec: timeline.startSec,
    toSec: timeline.endSec,
    beatsPerBar: timeline.beatsPerBar
  }
}
