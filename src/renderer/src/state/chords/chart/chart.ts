import { Chord, ChordSegment } from '../../../audio/music/chords'
import { PITCH_CLASSES, SEC_PER_MIN } from '@shared/units'
import { ClickGrid } from '../../transport/metronome'
import { ChordChart, Project, Track, instrumentOf, musicOf, tempoOf } from '../../song/project'
import { TIME_PRECISION } from '../../song/project/constants'
import { sameChord } from '../theory/chordText'
import { EDGE_SEC, NUDGE_SEC } from './constants'

// Times are rounded so bars that meet share an edge exactly.
const tidy = (sec: number): number => Math.round(sec * TIME_PRECISION) / TIME_PRECISION

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
 * Where `barCount` bars and their beats fall on the timeline at the song's tempo. Speed
 * scales it like a music clip, so bars lined up with a recording stay lined up. Null
 * without any bars.
 */
export function barGrid(project: Project, barCount: number): ChartTimeline | null {
  if (barCount <= 0) return null
  const { speed } = musicOf(project)
  const { bpm, beatsPerBar, startSec: writtenStart } = tempoOf(project)
  const secPerBeat = SEC_PER_MIN / (bpm * speed)
  const startSec = writtenStart / speed
  return {
    beats: Array.from({ length: barCount * beatsPerBar }, (_, k) => ({
      time: tidy(startSec + k * secPerBeat),
      downbeat: k % beatsPerBar === 0
    })),
    chords: [],
    secPerBeat,
    beatsPerBar,
    startSec: tidy(startSec),
    endSec: tidy(startSec + barCount * beatsPerBar * secPerBeat)
  }
}

/**
 * Where the chart's bars, beats and chords fall on the timeline, with every chord moved
 * by Key. Null without a chart or without any bars.
 */
export function chartTimeline(
  project: Project,
  chart: ChordChart | undefined | null
): ChartTimeline | null {
  const grid = chart && barGrid(project, chart.bars.length)
  if (!chart || !grid) return null
  const { semitones } = musicOf(project)
  const barSec = grid.secPerBeat * grid.beatsPerBar
  const chords: ChordSegment[] = []
  chart.bars.forEach((bar, b) => {
    const barStart = grid.startSec + b * barSec
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
  return { ...grid, chords }
}

/** The bars an instrumental plays, whichever instrument plays them. */
export function instrumentalTimeline(project: Project, track: Track): ChartTimeline | null {
  return instrumentOf(track) === 'beats'
    ? barGrid(project, track.beats?.parts.length ?? 0)
    : chartTimeline(project, track.chart)
}

/**
 * A spot in a chart: a bar, and which of its chords (0, or 1 for a split bar's second).
 * With `last`, a run of bars from `bar` (where the selection started) to `last`.
 */
export interface ChartPlace {
  bar: number
  slot: number
  last?: number
}

/** The first and last bar a place covers, in order. */
export function barRange(place: ChartPlace): [number, number] {
  const last = place.last ?? place.bar
  return [Math.min(place.bar, last), Math.max(place.bar, last)]
}

/** Which bar, and which half of it, plays at `sec`; null outside the chart. */
export function placeAt(
  timeline: ChartTimeline,
  /** A chart's bars, so a split bar's half can be found; drums have none. */
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

/** One bar, or half of a split bar, as the timeline shows it. */
export interface ChartCell {
  start: number
  end: number
  /** As it plays (Key applied); for an empty bar, the chord it carries on, if any. */
  chord: Chord | null
  /** An empty bar, carrying the chord before it on. */
  carried: boolean
  place: ChartPlace
}

/** Every bar of the chart where it falls on the timeline, so each can be picked. */
export function chartCells(project: Project, chart: ChordChart): ChartCell[] {
  const timeline = chartTimeline(project, chart)
  if (!timeline) return []
  const { semitones } = musicOf(project)
  const barSec = timeline.secPerBeat * timeline.beatsPerBar
  let last: Chord | null = null
  return chart.bars.flatMap((bar, b): ChartCell[] => {
    const barStart = timeline.startSec + b * barSec
    if (bar.length === 0) {
      const end = tidy(barStart + barSec)
      return [
        { start: tidy(barStart), end, chord: last, carried: true, place: { bar: b, slot: 0 } }
      ]
    }
    return bar.map((written, i) => {
      const chord = transposeChord(written, semitones)
      // A second half that's still the first chord just keeps it ringing.
      const carried = i > 0 && sameChord(chord, last)
      last = chord
      return {
        start: tidy(barStart + (i * barSec) / bar.length),
        end: tidy(barStart + ((i + 1) * barSec) / bar.length),
        chord,
        carried,
        place: { bar: b, slot: i }
      }
    })
  })
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

/** Where bar 1 has moved to while its grip is dragged, and what it snapped onto. */
export interface DraggedStart {
  /** In the song's own time (before Speed), as the tempo keeps it. */
  startSec: number
  /** Where on the timeline it snapped, for the guide line; null when it moves freely. */
  snappedAt: number | null
}

/** What bar 1 snaps onto while it's dragged, besides the start of the song. */
export interface BarSnapTargets {
  /** The music's beat. */
  beat?: { bpm: number; startSec: number } | null
  /** The edges of the clips on the timeline (timeline seconds), like a vocal's start. */
  clipEdges?: number[]
}

/**
 * Bar 1 dragged `deltaSec` along the timeline from `fromSec`. It snaps onto the start of
 * the song or a clip's edge when it comes within `toleranceSec` (timeline seconds) of
 * one, else onto the music's nearest beat, so lining the bars up with a vocal or the
 * music is easy. Edges come first, as in a clip drag: beats are so close together that
 * one is nearly always nearer than the edge being aimed for.
 */
export function draggedBarStart(
  fromSec: number,
  deltaSec: number,
  speed: number,
  { beat, clipEdges = [] }: BarSnapTargets,
  toleranceSec: number
): DraggedStart {
  const wanted = Math.max(0, fromSec + deltaSec * speed)
  const nearest = (targets: number[]): number | undefined =>
    targets
      .filter((sec) => sec >= 0 && Math.abs(sec - wanted) / speed <= toleranceSec)
      .sort((a, b) => Math.abs(a - wanted) - Math.abs(b - wanted))[0]
  const period = beat && beat.bpm > 0 ? SEC_PER_MIN / beat.bpm : 0
  const beats =
    beat && period ? [beat.startSec + Math.round((wanted - beat.startSec) / period) * period] : []
  const near = nearest([0, ...clipEdges.map((sec) => sec * speed)]) ?? nearest(beats)
  return near === undefined
    ? { startSec: tidy(wanted), snappedAt: null }
    : { startSec: tidy(near), snappedAt: tidy(near / speed) }
}

/** Bar 1 nudged a little earlier (-1) or later (1), in the song's own time. */
export const nudgedBarStart = (fromSec: number, direction: -1 | 1, speed: number): number =>
  Math.max(0, tidy(fromSec + direction * NUDGE_SEC * speed))
