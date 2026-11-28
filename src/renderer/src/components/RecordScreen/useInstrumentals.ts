import { useState } from 'react'
import { t } from '@shared/copy'
import type { Chord } from '../../audio/music/chords'
import { SongKey, transposeKey } from '../../audio/pitch/key'
import {
  ChartPlace,
  ChartTimeline,
  barRange,
  instrumentalTimeline,
  placeAt
} from '../../state/chords/chart/chart'
import { removeBars, swapBars } from '../../state/chords/chart/chartBars'
import { chordsInKey, keyOfChart } from '../../state/chords/theory/keyChords'
import { PickedBars } from '../../state/editing/trackSelection'
import {
  BeatChart,
  ChordChart,
  Track,
  feelsOf,
  instrumentOf,
  musicOf,
  withBeatParts,
  withChartBars,
  withChordBacking
} from '../../state/song/project'
import type { Song } from '../../state/song/useSong'
import { FALLBACK_KEY, FIRST_BAR } from './constants'
import type { SongSelection } from './useSongSelection'

interface Options {
  song: Song
  canEdit: boolean
  selection: SongSelection
  chordsTracks: Track[]
  /** The instrumental keeping time for the click: the first with a written chart. */
  timeKeeper: Track | undefined
  songKey: SongKey | null
  /** The music's beat, so a first instrumental starts in step with it. */
  musicTempo: { bpm: number; startSec: number } | null
  position: number
}

export interface Instrumentals {
  chart: ChordChart | null
  /** Drums are set bar by bar like chords, but have no chords of their own. */
  beats: BeatChart | undefined
  chartLine: ChartTimeline | null
  /** Chords offered when picking one: those of the chart's key, or a place to start. */
  suggestions: { label: string; chords: Chord[] }
  /** The bar playing now, or -1 outside the chart. */
  playingBar: number
  place: ChartPlace
  setPlace(place: ChartPlace): void
  /** Picks bars in the panel's editor, so Delete takes them. */
  pickPlace(place: ChartPlace): void
  /** Adds an instrumental: a track and its chart, selected so the chart opens below. */
  startChords(): void
  /** Opens a chord clicked on the timeline in its track's chart. */
  pickChord(trackId: string, place: ChartPlace): void
  /** Takes bars out of their chart; the bar before them is picked next. */
  removeBars(bars: PickedBars): void
  /** Takes out the bars picked in a track's editor. */
  removePicked(trackId: string): void
  swapBars(trackId: string, from: number, to: number): void
}

/** The chords and drums instrumentals play, and the bars picked in them. */
export function useInstrumentals({
  song,
  canEdit,
  selection,
  chordsTracks,
  timeKeeper,
  songKey,
  musicTempo,
  position
}: Options): Instrumentals {
  const open = song.song
  const [place, setPlace] = useState<ChartPlace>(FIRST_BAR)
  // The chart shown: the selected chords track's, else the first one's.
  const chartTrack = chordsTracks.find((t) => t.id === selection.selectedTrackId) ?? timeKeeper
  const beats = chartTrack && instrumentOf(chartTrack) === 'beats' ? chartTrack.beats : undefined
  const chart = (!beats && chartTrack?.chart) || null
  const chartLine = open && chartTrack ? instrumentalTimeline(open.data, chartTrack) : null

  // The key the chart is written in: the music's (before Key moved it), else the key
  // its chords suggest. Picking chords offers the ones that fit it.
  const chartKey = open
    ? songKey
      ? transposeKey(songKey, -musicOf(open.data).semitones)
      : keyOfChart(chart?.bars ?? [])
    : null
  const suggestions = chartKey
    ? { label: t('chords.inKey'), chords: chordsInKey(chartKey) }
    : { label: t('chords.startWith'), chords: chordsInKey(FALLBACK_KEY) }

  const pickChord = (trackId: string, at: ChartPlace): void => {
    selection.setClips([])
    selection.showTrack(trackId, 'bars')
    setPlace(at)
  }
  const removePickedBars = ({ trackId, first, last }: PickedBars): void => {
    const track = open?.data.tracks.find((t) => t.id === trackId)
    if (open && track?.beats && instrumentOf(track) === 'beats') {
      song.edit(
        withBeatParts(open.data, trackId, removeBars(track.beats.parts, first, last, 'main'))
      )
      setPlace({ bar: Math.max(0, first - 1), slot: 0 })
      return
    }
    const picked = track?.chart
    if (!open || !picked) return
    song.edit(
      withChartBars(
        open.data,
        trackId,
        removeBars(picked.bars, first, last, []),
        removeBars(feelsOf(picked), first, last, 'strum')
      )
    )
    setPlace({ bar: Math.max(0, first - 1), slot: 0 })
  }

  return {
    chart,
    beats,
    chartLine,
    suggestions,
    playingBar: (chartLine && placeAt(chartLine, chart?.bars ?? [], position)?.bar) ?? -1,
    place,
    setPlace,
    pickPlace: (at) => {
      setPlace(at)
      selection.setDeleteFocus('bars')
    },
    startChords: () => {
      if (!open || !canEdit) return
      const { project, track } = withChordBacking(open.data, suggestions.chords[0], musicTempo)
      song.edit(project)
      selection.showTrack(track.id)
      setPlace(FIRST_BAR)
    },
    pickChord,
    removeBars: removePickedBars,
    removePicked: (trackId) => {
      const [first, last] = barRange(place)
      removePickedBars({ trackId, first, last })
    },
    swapBars: (trackId, from, to) => {
      const track = open?.data.tracks.find((t) => t.id === trackId)
      if (open && track?.beats && instrumentOf(track) === 'beats') {
        song.edit(withBeatParts(open.data, trackId, swapBars(track.beats.parts, from, to)))
        pickChord(trackId, { bar: to, slot: 0 })
        return
      }
      const swapped = track?.chart
      if (!open || !swapped) return
      const feels = swapBars(feelsOf(swapped), from, to)
      song.edit(withChartBars(open.data, trackId, swapBars(swapped.bars, from, to), feels))
      pickChord(trackId, { bar: to, slot: 0 })
    }
  }
}
