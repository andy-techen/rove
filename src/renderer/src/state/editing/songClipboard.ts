import type { Chord } from '../../audio/music/chords'
import { ChartPlace, barRange } from '../chords/chart/chart'
import { copyBars } from '../chords/chart/chartBars'
import { BeatChart, ChordFeel, CopiedBeats, Track, feelsOf, instrumentOf } from '../song/project'
import type { CopiedClips } from './clipSets'

/** Bars of chords copied in Rove, with how each is played. */
export interface CopiedBars {
  bars: Chord[][]
  feels: ChordFeel[]
}

/** The bars copy and paste act on instead of clips: those open in the Instrumental panel. */
export type BarsTarget =
  | { kind: 'beats'; trackId: string; beats: BeatChart; range: [number, number] }
  | {
      kind: 'chart'
      trackId: string
      bars: Chord[][]
      feels: ChordFeel[]
      range: [number, number]
    }

/** What has been copied, each kind kept apart: clips, bars of chords and drum bars. */
export interface Clipboards {
  clips: CopiedClips | null
  bars: CopiedBars | null
  beats: CopiedBeats | null
}

/**
 * The bars picked in the panel's instrumental, when copy and paste should act on them:
 * only while no clips are picked. Drums and chords are separate targets, since copied
 * drum bars paste only into beats and copied chords only into charts.
 */
export function barsTarget(
  track: Track | undefined,
  place: ChartPlace,
  clipsPicked: boolean
): BarsTarget | null {
  if (clipsPicked || track?.role !== 'chords') return null
  const range = barRange(place)
  if (instrumentOf(track) === 'beats')
    return track.beats ? { kind: 'beats', trackId: track.id, beats: track.beats, range } : null
  return track.chart
    ? {
        kind: 'chart',
        trackId: track.id,
        bars: track.chart.bars,
        feels: feelsOf(track.chart),
        range
      }
    : null
}

/** The picked bars of a chart, with their feels, as copy and cut take them. */
export function copyChartBars(target: Extract<BarsTarget, { kind: 'chart' }>): CopiedBars {
  const [first, last] = target.range
  return { bars: copyBars(target.bars, first, last), feels: copyBars(target.feels, first, last) }
}

/** The bars `count` bars written from `first` cover, picked. */
export const placeOver = (first: number, count: number): ChartPlace => ({
  bar: first,
  slot: 0,
  last: first + count - 1
})

/**
 * Where `count` pasted bars go: in after the picked ones, so pasting adds to the song
 * rather than writing over it, and pasting again lays the copies end to end.
 */
export function pasteAfter(
  range: [number, number],
  count: number
): { at: number; place: ChartPlace } {
  const at = range[1] + 1
  return { at, place: placeOver(at, count) }
}

/** Whether Paste has something that fits where it would go. */
export const canPaste = (copied: Clipboards, target: BarsTarget | null): boolean =>
  copied.clips !== null ||
  (target?.kind === 'chart' && copied.bars !== null) ||
  (target?.kind === 'beats' && copied.beats !== null)

/** How far pasted clips reach past where they land: the playhead goes there after. */
export const pastedSpan = (copied: CopiedClips): number =>
  Math.max(...copied.items.map((item) => item.at + item.clip.duration))
