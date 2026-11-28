import { describe, expect, it } from 'vitest'
import { defaultPolish } from '../../../audio/polish/polish'
import { LYRICS_OFFSET_MAX_SEC } from './constants'
import {
  canBalanceHarmony,
  canBalanceMusic,
  createProject,
  moveTrack,
  nudgeLyrics,
  tracksOf,
  withLyrics,
  withMusicVolume,
  withNewTrack,
  withTrackChanges,
  withTrackName,
  withTrackPolish,
  withVocalPart
} from './tracks'
import type { Project } from './types'

describe('canBalanceHarmony', () => {
  const song = () => {
    const p = withNewTrack(createProject('Song', 48000), 'vocal', { part: 'harmony' }).project
    return { p, lead: p.tracks[0].id, harmony: p.tracks[1].id }
  }

  it('lets Rove set a harmony whose volume nobody has moved', () => {
    const { p, harmony } = song()
    expect(canBalanceHarmony(p, harmony)).toBe(true)
  })

  it('leaves a harmony whose volume the singer set', () => {
    const { p, harmony } = song()
    expect(canBalanceHarmony(withTrackChanges(p, harmony, { volume: 0.5 }), harmony)).toBe(false)
  })

  it('never sets a lead', () => {
    const { p, lead } = song()
    expect(canBalanceHarmony(p, lead)).toBe(false)
  })
})

describe('canBalanceMusic', () => {
  const song = () => {
    const p = withNewTrack(createProject('Song', 48000), 'backing').project
    const music = { ...p.tracks[1], sourceName: 'song.mp3', volume: 0.5 }
    return { ...p, tracks: [p.tracks[0], music] }
  }

  it('lets a lead take set untouched imported music', () => {
    const p = song()
    expect(canBalanceMusic(p, p.tracks[0].id)).toBe(true)
  })

  it('leaves music the singer has already turned up or down', () => {
    const p = withMusicVolume(song(), 0.3)
    expect(canBalanceMusic(p, p.tracks[0].id)).toBe(false)
  })

  it('leaves the music alone for a harmony take', () => {
    const p = song()
    const harmony = { ...p.tracks[0], part: 'harmony' as const }
    expect(canBalanceMusic({ ...p, tracks: [harmony, p.tracks[1]] }, harmony.id)).toBe(false)
  })
})

describe('role defaults', () => {
  it('starts the lead centred at full volume', () => {
    expect(createProject('Song', 48000).tracks[0]).toMatchObject({
      part: 'lead',
      volume: 1,
      pan: 0
    })
  })

  it('tucks harmonies in quieter, alternating left and right', () => {
    let p = createProject('Song', 48000)
    p = withNewTrack(p, 'vocal', { part: 'harmony' }).project
    p = withNewTrack(p, 'vocal', { part: 'harmony' }).project
    expect(p.tracks.slice(1).map((t) => [t.part, t.volume, t.pan])).toEqual([
      ['harmony', 0.7, -0.35],
      ['harmony', 0.7, 0.35]
    ])
  })

  it('starts a mastered music file lower so the vocal sits on top', () => {
    const song = createProject('Song', 48000)
    const { track } = withNewTrack(song, 'backing', { sourceName: 'backing-song.wav' })
    expect(track).toMatchObject({ volume: 0.5, pan: 0 })
    expect(track.part).toBeUndefined()
    // Music recorded here isn't mastered, so it starts at full volume.
    expect(withNewTrack(song, 'backing').track.volume).toBe(1)
  })
})

describe('withVocalPart', () => {
  const lead = () => {
    const p = createProject('Song', 48000)
    return { p, id: p.tracks[0].id }
  }

  it("turns a lead into a harmony with a harmony's starting mix and polish", () => {
    const { p, id } = lead()
    const [track] = withVocalPart(p, id, 'harmony').tracks
    expect(track).toMatchObject({ part: 'harmony', volume: 0.7, polish: defaultPolish('harmony') })
    expect(Math.abs(track.pan)).toBeCloseTo(0.35)
  })

  it('keeps the mix and polish the singer set', () => {
    const { p, id } = lead()
    const mixed = withTrackChanges(p, id, { volume: 0.4, pan: 0.2 })
    const tweaked = withTrackPolish(mixed, id, { ...defaultPolish('lead'), space: 0.9 })
    const [track] = withVocalPart(tweaked, id, 'harmony').tracks
    expect(track).toMatchObject({ volume: 0.4, pan: 0.2 })
    expect(track.polish?.space).toBe(0.9)
  })

  it('turns a harmony back into a lead', () => {
    const { p, id } = lead()
    const [track] = withVocalPart(withVocalPart(p, id, 'harmony'), id, 'lead').tracks
    expect(track).toMatchObject({ part: 'lead', volume: 1, pan: 0, polish: defaultPolish('lead') })
  })
})

describe('withNewTrack', () => {
  it('numbers tracks per role', () => {
    let p = createProject('Song', 48000)
    p = withNewTrack(p, 'vocal').project
    p = withNewTrack(p, 'backing', { sourceName: 'beat.mp3' }).project
    p = withNewTrack(p, 'backing').project
    expect(p.tracks.map((t) => t.name)).toEqual(['Vocal 1', 'Vocal 2', 'Backing 1', 'Backing 2'])
    expect(tracksOf(p, 'backing')[0].sourceName).toBe('beat.mp3')
  })

  it('continues after the highest number instead of reusing a gap', () => {
    const p = createProject('Song', 48000)
    const renamed = { ...p, tracks: [{ ...p.tracks[0], name: 'Vocal 4' }] }
    expect(withNewTrack(renamed, 'vocal').track.name).toBe('Vocal 5')
  })
})

describe('lyrics', () => {
  const withWords = withLyrics(createProject('Song', 48000), {
    title: 'Song',
    lines: [{ time: 1, text: 'Hi' }],
    offsetSec: 0
  })

  it('nudges the timing and keeps it within range', () => {
    expect(nudgeLyrics(withWords, 0.25).lyrics?.offsetSec).toBe(0.25)
    expect(nudgeLyrics(withWords, -999).lyrics?.offsetSec).toBe(-LYRICS_OFFSET_MAX_SEC)
  })

  it('leaves a song without lyrics alone', () => {
    const song = createProject('Song', 48000)
    expect(nudgeLyrics(song, 1)).toBe(song)
  })
})

describe('moveTrack', () => {
  // Backing 1, then Vocal 1, Vocal 2, Vocal 3.
  const song = () => {
    let p = withNewTrack(createProject('Song', 48000), 'backing').project
    p = withNewTrack(p, 'vocal').project
    p = withNewTrack(p, 'vocal').project
    return p
  }
  const names = (p: Project) => p.tracks.map((t) => t.name)
  const vocals = (p: Project) => tracksOf(p, 'vocal').map((t) => t.name)

  it('moves a track to a new place among tracks of its kind', () => {
    const p = song()
    const moved = moveTrack(p, tracksOf(p, 'vocal')[0].id, 2)
    expect(vocals(moved)).toEqual(['Vocal 2', 'Vocal 3', 'Vocal 1'])
    expect(tracksOf(moved, 'backing').map((t) => t.name)).toEqual(['Backing 1'])
  })

  it('moves an instrumental among the music files, not into the vocals', () => {
    const p = withNewTrack(song(), 'chords').project
    const chords = tracksOf(p, 'chords')[0]
    const moved = moveTrack(p, chords.id, 0)
    const music = moved.tracks.filter((t) => t.role !== 'vocal').map((t) => t.name)
    expect(music).toEqual(['Backing 2', 'Backing 1'])
    expect(vocals(moved)).toEqual(vocals(p))
  })

  it('leaves the song as it is for a place off either end', () => {
    const p = song()
    const v1 = tracksOf(p, 'vocal')[0].id
    expect(names(moveTrack(p, v1, 3))).toEqual(names(p))
    expect(names(moveTrack(p, v1, -1))).toEqual(names(p))
  })
})

describe('withTrackName', () => {
  it('renames a track, trimming spaces, and keeps the old name for a blank one', () => {
    const p = createProject('Song', 48000)
    const id = p.tracks[0].id
    expect(withTrackName(p, id, '  Chorus harmony ').tracks[0].name).toBe('Chorus harmony')
    expect(withTrackName(p, id, '   ').tracks[0].name).toBe('Vocal 1')
  })
})

describe('createProject artist', () => {
  it('keeps a named artist and leaves out a blank one', () => {
    expect(createProject('Song', 48000, '  Sam ').artist).toBe('Sam')
    expect(createProject('Song', 48000, '  ')).not.toHaveProperty('artist')
  })

  it('keeps a note carried over from the wishlist and leaves out a blank one', () => {
    expect(createProject('Song', 48000, undefined, ' Lower key ').note).toBe('Lower key')
    expect(createProject('Song', 48000, 'Sam', ' ')).not.toHaveProperty('note')
  })
})
