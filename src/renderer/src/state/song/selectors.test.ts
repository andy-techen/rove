import { describe, expect, it } from 'vitest'
import { createProject, pasteClip, withRecordedClip } from './project'
import { polishParams } from '../../audio/polish/polish'
import { backingTitle, edgeAfter, edgeBefore, mixdownOf, songEnd } from './selectors'

describe('backingTitle', () => {
  it('shows a backing file the way the singer named it', () => {
    expect(backingTitle('backing-Ben Platt - Grow As We Go - Karaoke.mp3')).toBe(
      'Ben Platt - Grow As We Go - Karaoke'
    )
    expect(backingTitle('Demo Song.mp3')).toBe('Demo Song')
  })
})

describe('clip-edge navigation', () => {
  // Vocal 1 has clips at 2–5 s and 8–10 s.
  const song = (() => {
    let p = createProject('Song', 48000)
    const id = p.tracks[0].id
    p = withRecordedClip(p, id, { file: 'a.wav', start: 2, offset: 0, duration: 3 })
    p = withRecordedClip(p, id, { file: 'b.wav', start: 8, offset: 0, duration: 2 })
    return { p, id }
  })()

  it('jumps to the start of the clip the playhead is in, then the clip before', () => {
    expect(edgeBefore(song.p, 9, song.id)).toBe(8)
    expect(edgeBefore(song.p, 8, song.id)).toBe(5)
  })

  it('jumps to the end of the clip, then the start of the next', () => {
    expect(edgeAfter(song.p, 3, song.id)).toBe(5)
    expect(edgeAfter(song.p, 5, song.id)).toBe(8)
  })

  it('stops at the start of the song and at the last clip', () => {
    expect(edgeBefore(song.p, 1, song.id)).toBe(0)
    expect(edgeAfter(song.p, 10, song.id)).toBe(10)
    expect(songEnd(song.p)).toBe(10)
  })
})

describe('pasteClip', () => {
  it('pastes a copy at the playhead, pointing at the same audio', () => {
    const p = createProject('Song', 48000)
    const id = p.tracks[0].id
    const clip = { file: 'a.wav', offset: 1, duration: 3 }
    const { project, clipId } = pasteClip(p, id, clip, 6)
    expect(project.tracks[0].clips).toEqual([{ ...clip, id: clipId, start: 6 }])
  })
})

describe('mixdownOf', () => {
  const recorded = () => {
    let p = createProject('Song', 48000)
    const id = p.tracks[0].id
    p = withRecordedClip(p, id, { file: 'a.wav', start: 2, offset: 0, duration: 3 })
    p = withRecordedClip(p, id, { file: 'missing.wav', start: 6, offset: 0, duration: 1 })
    return p
  }
  const audio = { 'a.wav': { duration: 3 } as AudioBuffer }

  it('mixes clips whose audio is loaded, at the song’s current settings', () => {
    const { tracks } = mixdownOf(recorded(), audio)
    expect(tracks[0].clips.map((c) => c.start)).toEqual([2])
    expect(tracks[0].polish).toBeDefined()
  })

  it('runs past the last clip long enough for the reverb to ring out', () => {
    const song = recorded()
    const decay = polishParams(song.tracks[0].polish!).reverbDecaySec
    expect(mixdownOf(song, audio).lengthSec).toBeCloseTo(songEnd(song) + decay)
  })
})
