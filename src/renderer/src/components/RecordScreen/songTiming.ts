import type { ComponentProps } from 'react'
import { ChartTimeline, chartClickGrid, instrumentalTimeline } from '../../state/chords/chart/chart'
import {
  Project,
  Track,
  chordsTracksOf,
  musicOf,
  tempoOf,
  withClick,
  withClickOn,
  withSongBeats,
  withSongTempo,
  withTempoOfMusic
} from '../../state/song/project'
import { ClickGrid, clickGrid, tempoOfMusic } from '../../state/transport/metronome'
import type { Beat as Heard } from '../../audio/music/stretch'
import type { Beat } from '../Beat'

export interface SongTiming {
  chordsTracks: Track[]
  /** The first written chart keeps time for the click; new ones start in step with it. */
  timeKeeper: Track | undefined
  /** The music's beat, as a tempo the instrumentals can keep to. */
  musicTempo: { bpm: number; startSec: number } | null
  /** Where the click ticks, or null with nothing to keep time. */
  grid: ClickGrid | null
}

/** What keeps time in a song: its first chart, else the beat heard in its music. */
export function songTiming(
  project: Project | undefined,
  beatFile: string | null,
  beat: Heard | null
): SongTiming {
  const chordsTracks = project ? chordsTracksOf(project) : []
  const timeKeeper = chordsTracks.find((track) => project && instrumentalTimeline(project, track))
  const timeLine: ChartTimeline | null =
    project && timeKeeper ? instrumentalTimeline(project, timeKeeper) : null
  const musicTempo = project && beatFile ? tempoOfMusic(project, beatFile, beat) : null
  // A chords track keeps time with its chart, which knows where every bar starts.
  const grid = timeLine
    ? chartClickGrid(timeLine)
    : project && beatFile
      ? clickGrid(project, beatFile, beat)
      : null
  return { chordsTracks, timeKeeper, musicTempo, grid }
}

/** The transport bar's click and tempo controls; tempo only once there's an instrumental. */
export function beatControls(
  project: Project,
  timing: SongTiming,
  locked: boolean,
  edit: (next: Project, coalesce?: string) => void
): ComponentProps<typeof Beat> {
  const { musicTempo } = timing
  return {
    locked,
    click: {
      on: musicOf(project).clickOn,
      level: musicOf(project).click,
      available: timing.grid !== null,
      onOn: (on) => edit(withClickOn(project, on)),
      onLevel: (level, key) => edit(withClick(project, level), key)
    },
    tempo:
      timing.chordsTracks.length > 0
        ? {
            value: tempoOf(project),
            onTempo: (bpm) => edit(withSongTempo(project, bpm), 'song-tempo'),
            onBeats: (n) => edit(withSongBeats(project, n)),
            onMatchMusic: musicTempo ? () => edit(withTempoOfMusic(project, musicTempo)) : undefined
          }
        : null
  }
}
