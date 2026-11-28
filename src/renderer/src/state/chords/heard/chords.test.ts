import { describe, expect, it } from 'vitest'
import { ChordSegment } from '../../../audio/music/chords'
import {
  Clip,
  Project,
  createProject,
  withMusicPitch,
  withMusicSpeed,
  withNewTrack
} from '../../song/project'
import { activeChordIndex, chordTimeline } from './chords'

const clip = (start: number, offset: number, duration: number): Clip => ({
  id: 'm',
  file: 'music.wav',
  start,
  offset,
  duration
})

/** Music placed 1 s into the song, trimmed to start 2 s into its recording. */
function withMusic(): Project {
  const added = withNewTrack(createProject('Song', 48000), 'backing', { sourceName: 'a.mp3' })
  return {
    ...added.project,
    tracks: added.project.tracks.map((t) =>
      t.role === 'backing' ? { ...t, clips: [clip(1, 2, 6)] } : t
    )
  }
}

// C for the first 4 s of the recording, then Am to 10 s.
const heard: ChordSegment[] = [
  { start: 0, end: 4, chord: { root: 0, quality: 'major' } },
  { start: 4, end: 10, chord: { root: 9, quality: 'minor' } }
]

describe('chordTimeline', () => {
  it('places the chords where the music sits, leaving out what is trimmed away', () => {
    expect(chordTimeline(withMusic(), 'music.wav', heard)).toEqual([
      { start: 1, end: 3, chord: { root: 0, quality: 'major' } },
      { start: 3, end: 7, chord: { root: 9, quality: 'minor' } }
    ])
  })

  it('follows the music when it is sped up', () => {
    const faster = withMusicSpeed(withMusic(), 1.25)
    // The 2 s of C left after the trim play in 2 / 1.25 = 1.6 s.
    const [first] = chordTimeline(faster, 'music.wav', heard)
    expect(first.end - first.start).toBeCloseTo(1.6)
  })

  it('names the chords in the key the music plays in', () => {
    const up = withMusicPitch(withMusic(), 2)
    expect(chordTimeline(up, 'music.wav', heard)[0].chord).toEqual({ root: 2, quality: 'major' })
  })
})

describe('activeChordIndex', () => {
  const chords = chordTimeline(withMusic(), 'music.wav', heard)

  it('is the chord playing at the playhead, or none outside the music', () => {
    expect(activeChordIndex(chords, 0.5)).toBe(-1)
    expect(activeChordIndex(chords, 2)).toBe(0)
    expect(activeChordIndex(chords, 5)).toBe(1)
    expect(activeChordIndex(chords, 9)).toBe(-1)
  })
})
