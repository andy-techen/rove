import { ChordSegment } from '../audio/chords'
import { PITCH_CLASSES } from '../audio/key'
import { Project, musicOf, tracksOf } from './project'

// Times are rounded so chords that meet share an edge exactly.
const PRECISION = 1e6
const tidy = (sec: number): number => Math.round(sec * PRECISION) / PRECISION

/**
 * Chords heard in one music recording, placed on the timeline as the music plays: each
 * of its clips shows the chords of the stretch it plays, at the music's speed and key.
 */
export function chordTimeline(
  project: Project,
  file: string,
  heard: ChordSegment[]
): ChordSegment[] {
  const { speed, semitones } = musicOf(project)
  const clips = tracksOf(project, 'backing')
    .flatMap((t) => t.clips)
    .filter((c) => c.file === file)
    .sort((a, b) => a.start - b.start)
  return clips.flatMap((clip) => {
    // Clip times are in time as played; the recording's own seconds run `speed` times faster.
    const from = clip.offset * speed
    const to = (clip.offset + clip.duration) * speed
    const place = (sec: number): number => tidy(clip.start + sec / speed - clip.offset)
    return heard
      .filter((s) => s.end > from && s.start < to)
      .map((s) => ({
        start: place(Math.max(s.start, from)),
        end: place(Math.min(s.end, to)),
        chord: s.chord && {
          ...s.chord,
          root: (((s.chord.root + semitones) % PITCH_CLASSES) + PITCH_CLASSES) % PITCH_CLASSES
        }
      }))
  })
}

/** The chord playing at `positionSec`, or -1 outside the music. */
export const activeChordIndex = (chords: ChordSegment[], positionSec: number): number =>
  chords.findIndex((c) => positionSec >= c.start && positionSec < c.end)
