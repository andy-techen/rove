import { describe, expect, it } from 'vitest'
import {
  createProject,
  deleteClip,
  moveClip,
  withNewTrack,
  withRecordedClip,
  withTrackChanges,
  withoutTracks
} from './project'
import { polishParams } from '../../audio/polish/polish'
import {
  backingTitle,
  canLineUpClip,
  canSyncHarmonyClip,
  edgeAfter,
  edgeBefore,
  joinGroups,
  mixdownOf,
  pasteTarget,
  playbackKey,
  skipTarget,
  songEnd
} from './selectors'

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

describe('skipping', () => {
  // A song that ends at 20 s.
  const song = (() => {
    let p = createProject('Song', 48000)
    p = withRecordedClip(p, p.tracks[0].id, { file: 'a.wav', start: 0, offset: 0, duration: 20 })
    return p
  })()

  it('skips five seconds back or forward', () => {
    expect(skipTarget(song, 12, -1)).toBe(7)
    expect(skipTarget(song, 12, 1)).toBe(17)
  })

  it('stops at the start and end of the song', () => {
    expect(skipTarget(song, 3, -1)).toBe(0)
    expect(skipTarget(song, 18, 1)).toBe(20)
  })

  it('stays put when skipping forward from past the end', () => {
    expect(skipTarget(song, 25, 1)).toBe(25)
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

describe('playbackKey', () => {
  const song = () => {
    const p = createProject('Song', 48000)
    const id = p.tracks[0].id
    const withClip = withRecordedClip(p, id, { file: 'a.wav', start: 2, offset: 0, duration: 3 })
    return { p: withClip, id, clipId: withClip.tracks[0].clips[0].id }
  }

  it('changes when what plays changes: a clip deleted or moved, a track removed', () => {
    const { p, id, clipId } = song()
    const key = playbackKey(p)
    expect(playbackKey(deleteClip(p, id, clipId))).not.toBe(key)
    expect(playbackKey(moveClip(p, id, clipId, 4))).not.toBe(key)
    expect(playbackKey(withoutTracks(p, [id]))).not.toBe(key)
  })

  it('stays the same for mix changes, which the mixer applies live', () => {
    const { p, id } = song()
    const mixed = withTrackChanges(p, id, { volume: 0.2, pan: -0.5, muted: true })
    expect(playbackKey(mixed)).toBe(playbackKey(p))
  })
})

describe('pasteTarget', () => {
  const song = () => {
    const start = createProject('Song', 48000)
    const vocal = withNewTrack(start, 'vocal')
    const backing = withNewTrack(vocal.project, 'backing')
    return { p: backing.project, v1: start.tracks[0].id, v2: vocal.track.id, b1: backing.track.id }
  }

  it('pastes onto the picked track when it is the same kind as the copy', () => {
    const { p, v1, v2 } = song()
    expect(pasteTarget(p, v1, v2)).toBe(v2)
  })

  it('keeps a copy on its own track rather than mixing vocals and backing', () => {
    const { p, v1, b1 } = song()
    expect(pasteTarget(p, v1, b1)).toBe(v1)
    expect(pasteTarget(p, v1, null)).toBe(v1)
  })
})

describe('joinGroups', () => {
  const clip = (id: string, start: number, group?: string) => ({ id, start, duration: 1, group })

  it('draws grouped clips next to each other as one block', () => {
    const { clips, blocks } = joinGroups([clip('a', 0, 'g'), clip('b', 3, 'g'), clip('c', 6)])
    expect(blocks).toEqual([{ start: 0, end: 4, clipIds: ['a', 'b'] }])
    expect(clips.map((c) => [c.joinedBefore, c.joinedAfter])).toEqual([
      [false, true],
      [true, false],
      [false, false]
    ])
  })

  it('keeps a clip from outside the group between them as its own clip', () => {
    const { blocks } = joinGroups([clip('a', 0, 'g'), clip('x', 2), clip('b', 4, 'g')])
    expect(blocks).toEqual([])
  })
})

describe("fixing a take's timing", () => {
  // A lead take from 0–30 s and a harmony take from 10–20 s, with or without music.
  const song = (withMusic: boolean) => {
    let p = withNewTrack(createProject('Song', 48000), 'vocal', { part: 'harmony' }).project
    const [lead, harmony] = p.tracks
    p = withRecordedClip(p, lead.id, { id: 'l', file: 'l.wav', start: 0, offset: 0, duration: 30 })
    p = withRecordedClip(p, harmony.id, {
      id: 'h',
      file: 'h.wav',
      start: 10,
      offset: 0,
      duration: 10
    })
    if (withMusic) {
      const { project, track } = withNewTrack(p, 'backing')
      p = withRecordedClip(project, track.id, {
        id: 'm',
        file: 'm.wav',
        start: 0,
        offset: 0,
        duration: 60
      })
    }
    return {
      p,
      lead: { trackId: lead.id, clipId: 'l' },
      harmony: { trackId: harmony.id, clipId: 'h' }
    }
  }

  it('lines up a vocal take only when there is music to line it up with', () => {
    const withMusic = song(true)
    expect(canLineUpClip(withMusic.p, withMusic.lead)).toBe(true)
    const { p, lead } = song(false)
    expect(canLineUpClip(p, lead)).toBe(false)
  })

  it('syncs a harmony take with a lead take under it', () => {
    const { p, harmony, lead } = song(false)
    expect(canSyncHarmonyClip(p, harmony)).toBe(true)
    expect(canSyncHarmonyClip(p, lead)).toBe(false)
  })

  it('has nothing to sync a harmony with where no lead was sung', () => {
    const { p, harmony } = song(false)
    expect(canSyncHarmonyClip(moveClip(p, harmony.trackId, 'h', 40), harmony)).toBe(false)
  })
})
