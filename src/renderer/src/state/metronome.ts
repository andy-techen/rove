import { Beat } from '../audio/stretch'
import { Project, musicOf, tracksOf } from './project'

export interface Click {
  /** Timeline seconds. */
  time: number
  /** The first beat of a bar, clicked higher. */
  accent: boolean
}

/** The metronome for a song: a click on every beat the music plays. */
export interface ClickGrid {
  clicks: Click[]
  /** The average time between beats, for the count-in. */
  periodSec: number
  fromSec: number
  toSec: number
}

// Most songs a beginner sings along to are in 4/4.
const BEATS_PER_BAR = 4
const SEC_PER_MIN = 60

/**
 * The metronome for a song, from the beats heard in one of its music recordings.
 * Clicks land on the music's own beats (so they follow it when it speeds up or drags),
 * moved and stretched with every clip that plays that recording.
 */
export function clickGrid(project: Project, file: string, beat: Beat | null): ClickGrid | null {
  const music = tracksOf(project, 'backing').flatMap((t) => t.clips)
  const sources = music.filter((c) => c.file === file)
  if (!beat || sources.length === 0 || beat.bpm <= 0) return null
  const { speed } = musicOf(project)
  const clicks = sources
    .flatMap((clip) =>
      beat.times.flatMap((sec, k) => {
        // Clip times are in time as played; the recording's own seconds run `speed` times faster.
        const played = sec / speed
        if (played < clip.offset || played > clip.offset + clip.duration) return []
        return [{ time: clip.start + played - clip.offset, accent: k % BEATS_PER_BAR === 0 }]
      })
    )
    .sort((a, b) => a.time - b.time)
  return {
    clicks,
    periodSec: SEC_PER_MIN / beat.bpm / speed,
    fromSec: Math.min(...music.map((c) => c.start)),
    toSec: Math.max(...music.map((c) => c.start + c.duration))
  }
}

/** The clicks between two times on the timeline. */
export const clickTimes = (grid: ClickGrid, fromSec: number, toSec: number): Click[] =>
  grid.clicks.filter((c) => c.time >= fromSec && c.time <= toSec)

/** One bar of clicks before a take, so the singer comes in on time. */
export const countInSec = (grid: ClickGrid): number => BEATS_PER_BAR * grid.periodSec

/** The count-in's ticks, timed from the start of the bar before the take (first accented). */
export const countInTicks = (grid: ClickGrid): Click[] =>
  Array.from({ length: BEATS_PER_BAR }, (_, i) => ({
    time: i * grid.periodSec - countInSec(grid),
    accent: i === 0
  }))
