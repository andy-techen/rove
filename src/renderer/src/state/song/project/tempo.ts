// The song's tempo, shared by every instrumental and the metronome.
import { BPM_PRECISION, CHART_BPM_RANGE, DEFAULT_TEMPO } from './constants'
import type { BeatsPerBar, Project, SongTempo } from './types'

/** A tempo with its bpm kept in the sensible range, to a hundredth. */
export const tempoFrom = (tempo: SongTempo): SongTempo => ({
  bpm:
    Math.round(
      Math.max(CHART_BPM_RANGE.min, Math.min(CHART_BPM_RANGE.max, tempo.bpm)) * BPM_PRECISION
    ) / BPM_PRECISION,
  beatsPerBar: tempo.beatsPerBar,
  startSec: tempo.startSec
})

/** The song's beat: what its instrumentals and their click keep time with. */
export const tempoOf = (project: Project): SongTempo => project.tempo ?? DEFAULT_TEMPO

/** Every instrumental faster or slower together. */
export const withSongTempo = (project: Project, bpm: number): Project => ({
  ...project,
  tempo: tempoFrom({ ...tempoOf(project), bpm })
})

/** Every instrumental on the music's beat: its tempo, with bar 1 on its first beat. */
export const withTempoOfMusic = (
  project: Project,
  heard: { bpm: number; startSec: number }
): Project => ({ ...project, tempo: tempoFrom({ ...tempoOf(project), ...heard }) })

/** Every instrumental in threes or fours together. */
export const withSongBeats = (project: Project, beatsPerBar: BeatsPerBar): Project => ({
  ...project,
  tempo: { ...tempoOf(project), beatsPerBar }
})

/** Every instrumental's bar 1, and the metronome's, at `startSec` (never before the song). */
export const withSongStart = (project: Project, startSec: number): Project => ({
  ...project,
  tempo: { ...tempoOf(project), startSec: Math.max(0, startSec) }
})
