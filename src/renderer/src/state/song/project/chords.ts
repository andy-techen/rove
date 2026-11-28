// The chord chart, the chords track that plays it, and its drums.
import type { Chord } from '../../../audio/music/chords'
import { CHART_MAX_BARS, DEFAULT_TEMPO, NEW_CHART_BARS } from './constants'
import { tempoFrom } from './tempo'
import { tracksOf, withNewTrack } from './tracks'
import type {
  BarBeat,
  BeatChart,
  ChordChart,
  ChordFeel,
  CopiedBeats,
  GuitarFeel,
  Instrument,
  MyBeat,
  PianoFeel,
  Project,
  Track
} from './types'

/** A bar's feel as the guitar plays it: rolling piano parts are fingerpicked. */
export const guitarFeel = (feel: ChordFeel): GuitarFeel =>
  feel === 'pick' || feel === 'flowing' ? 'pick' : 'strum'

/** A bar's feel as the piano plays it: a strum is struck chords, a pick rolls. */
export const pianoFeel = (feel: ChordFeel): PianoFeel =>
  feel === 'pick' || feel === 'flowing' ? 'flowing' : 'chords'

/** The part a bar plays to hear `beat`. */
export const mineOf = (beat: MyBeat): BarBeat => `mine-${beat.n}`

/** The tracks that play chords the singer wrote. */
export const chordsTracksOf = (project: Project): Track[] => tracksOf(project, 'chords')

/** What plays a chords track's part. */
export const instrumentOf = (track: Track): Instrument => track.instrument ?? 'guitar'

/**
 * Adds a chords track with a chart to fill in: one bar of `first`, then bars that carry
 * it on. It keeps time with the song's other chords, so new parts line up with them.
 */
export function withChordBacking(
  project: Project,
  first: Chord,
  /** The music's beat, when Rove has heard it: a first instrumental starts in step. */
  heard?: { bpm: number; startSec: number } | null
): { project: Project; track: Track } {
  const chart: ChordChart = {
    bars: [[first], ...Array.from({ length: NEW_CHART_BARS - 1 }, () => [])]
  }
  const timed = project.tempo
    ? project
    : { ...project, tempo: tempoFrom({ ...DEFAULT_TEMPO, ...heard }) }
  const { project: added, track } = withNewTrack(timed, 'chords')
  const withChart = { ...track, chart }
  return {
    project: { ...added, tracks: added.tracks.map((t) => (t.id === track.id ? withChart : t)) },
    track: withChart
  }
}

/**
 * The track played by `instrument`. Each keeps what was written for it, so switching
 * back loses nothing. Drums played for the first time start on the main groove for
 * `bars` bars, enough to run with the song.
 */
export function withInstrument(
  project: Project,
  trackId: string,
  instrument: Instrument,
  bars: number
): Project {
  return {
    ...project,
    tracks: project.tracks.map((t) => {
      if (t.id !== trackId) return t
      const next = { ...t }
      if (instrument === 'guitar') delete next.instrument
      else next.instrument = instrument
      if (instrument === 'beats' && !next.beats) {
        const count = Math.max(NEW_CHART_BARS, Math.min(CHART_MAX_BARS, bars))
        next.beats = { groove: 'pop', parts: Array<BarBeat>(count).fill('main') }
      }
      return next
    })
  }
}

const mapChart = (
  project: Project,
  trackId: string,
  change: (chart: ChordChart) => ChordChart
): Project => ({
  ...project,
  tracks: project.tracks.map((t) =>
    t.id === trackId && t.chart ? { ...t, chart: change(t.chart) } : t
  )
})

/** How each bar is played, one per bar: unset ones are strummed. */
export const feelsOf = (chart: ChordChart): ChordFeel[] =>
  chart.bars.map((_, i) => chart.feels?.[i] ?? 'strum')

/**
 * The chart with new bars. A change that moves bars around passes how they're played,
 * moved the same way; otherwise each bar keeps its own.
 */
export function withChartBars(
  project: Project,
  trackId: string,
  bars: Chord[][],
  feels?: ChordFeel[]
): Project {
  return mapChart(project, trackId, (chart) => {
    const kept = bars.slice(0, CHART_MAX_BARS)
    const played = kept.map((_, i) => (feels ?? chart.feels)?.[i] ?? 'strum')
    const next: ChordChart = { ...chart, bars: kept }
    // Only kept when some bar isn't strummed, so all-strummed charts stay as they were.
    if (played.some((f) => f !== 'strum')) next.feels = played
    else delete next.feels
    return next
  })
}

/** Bars `first` to `last` played with `feel`. */
export const withChartFeel = (
  project: Project,
  trackId: string,
  first: number,
  last: number,
  feel: ChordFeel
): Project => {
  const chart = project.tracks.find((t) => t.id === trackId)?.chart
  if (!chart) return project
  const feels = feelsOf(chart).map((f, i) => (i >= first && i <= last ? feel : f))
  return withChartBars(project, trackId, chart.bars, feels)
}

const mapBeats = (
  project: Project,
  trackId: string,
  change: (beats: BeatChart) => BeatChart
): Project => ({
  ...project,
  tracks: project.tracks.map((t) =>
    t.id === trackId && t.beats ? { ...t, beats: change(t.beats) } : t
  )
})

/** The drums with a new part for each bar. */
export const withBeatParts = (project: Project, trackId: string, parts: BarBeat[]): Project =>
  mapBeats(project, trackId, (beats) => ({ ...beats, parts: parts.slice(0, CHART_MAX_BARS) }))

/** A beat of your own, added, or changed when it's already there. */
export const withMyBeat = (project: Project, trackId: string, beat: MyBeat): Project =>
  mapBeats(project, trackId, (beats) => {
    const mine = beats.mine ?? []
    const known = mine.some((b) => b.n === beat.n)
    return {
      ...beats,
      mine: known ? mine.map((b) => (b.n === beat.n ? beat : b)) : [...mine, beat]
    }
  })

/**
 * A beat of your own taken away. The bars that played it move to the beat made before it
 * (or the next one, if it was the first), and to the main groove only when none is left.
 */
export const withoutMyBeat = (project: Project, trackId: string, n: number): Project =>
  mapBeats(project, trackId, (beats) => {
    const mine = beats.mine ?? []
    const at = mine.findIndex((b) => b.n === n)
    const instead = mine[at - 1] ?? mine[at + 1]
    const next: BarBeat = instead ? mineOf(instead) : 'main'
    return {
      ...beats,
      parts: beats.parts.map((p) => (p === `mine-${n}` ? next : p)),
      mine: mine.filter((b) => b.n !== n)
    }
  })

/** Bars `first` to `last` of a beats track, ready to paste anywhere. */
export function copyBeats(beats: BeatChart, first: number, last: number): CopiedBeats {
  const parts = beats.parts.slice(first, last + 1)
  return { parts, mine: (beats.mine ?? []).filter((b) => parts.includes(mineOf(b))) }
}

/**
 * Copied drum bars put in at bar `at`. Beats of your own they use come along: one the
 * track already has (same number, same hits) is used as it is, and any other is added as
 * a new beat, so pasting into another track never plays the wrong one.
 */
export const withPastedBeats = (
  project: Project,
  trackId: string,
  at: number,
  copied: CopiedBeats
): Project =>
  mapBeats(project, trackId, (beats) => {
    let mine = beats.mine ?? []
    const renamed = new Map<BarBeat, BarBeat>()
    for (const beat of copied.mine) {
      const same = mine.find(
        (b) => b.n === beat.n && JSON.stringify(b.hits) === JSON.stringify(beat.hits)
      )
      if (same) continue
      const added = { ...beat, n: nextBeatNumber({ ...beats, mine }) }
      mine = [...mine, added]
      renamed.set(mineOf(beat), mineOf(added))
    }
    const parts = copied.parts.map((p) => renamed.get(p) ?? p)
    return {
      ...beats,
      mine,
      parts: [...beats.parts.slice(0, at), ...parts, ...beats.parts.slice(at)].slice(
        0,
        CHART_MAX_BARS
      )
    }
  })

/** The number the next beat you make is called by. */
export const nextBeatNumber = (beats: BeatChart): number =>
  Math.max(0, ...(beats.mine ?? []).map((b) => b.n)) + 1
