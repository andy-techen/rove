import { describe, expect, it } from 'vitest'
import { PolishSettings } from '../../audio/polish/polish'
import {
  Clip,
  Project,
  MIN_CLIP_SEC,
  deleteClip,
  moveClip,
  setClipFades,
  splitClip,
  trimClipEnd,
  trimClipStart,
  withKnownDurations,
  createProject,
  formatDuration,
  formatMillis,
  insertClip,
  parseProject,
  polishOf,
  tracksOf,
  withSongKey,
  musicOf,
  withMusicSpeed,
  withMusicPitch,
  withMusicTone,
  withClick,
  withClickOn,
  MUSIC_TONE_MAX_DB,
  MUSIC_SPEED_RANGE,
  nudgeLyrics,
  withLyrics,
  LYRICS_OFFSET_MAX_SEC,
  withNewTrack,
  withRecordedClip,
  withTrackAudio,
  withTrackChanges,
  withVocalsBack,
  withoutVocals
} from './project'

const clip = (id: string, start: number, duration: number, offset = 0): Clip => ({
  id,
  file: `${id}.wav`,
  start,
  offset,
  duration
})
const spans = (clips: Clip[]): [string, number, number, number][] =>
  clips.map((c) => [c.file, c.start, c.offset, c.duration])

describe('insertClip (punch-in)', () => {
  const existing = clip('old', 10, 20) // covers 10–30

  it('keeps clips that do not overlap', () => {
    expect(spans(insertClip([existing], clip('new', 40, 5)))).toEqual([
      ['old.wav', 10, 0, 20],
      ['new.wav', 40, 0, 5]
    ])
  })

  it('trims the end of a clip the new take starts inside', () => {
    expect(spans(insertClip([existing], clip('new', 25, 10)))).toEqual([
      ['old.wav', 10, 0, 15],
      ['new.wav', 25, 0, 10]
    ])
  })

  it('trims the start of a clip the new take ends inside, keeping its audio aligned', () => {
    expect(spans(insertClip([existing], clip('new', 5, 10)))).toEqual([
      ['new.wav', 5, 0, 10],
      ['old.wav', 15, 5, 15]
    ])
  })

  it('splits a clip around a take recorded in its middle', () => {
    const result = insertClip([existing], clip('new', 15, 5))
    expect(spans(result)).toEqual([
      ['old.wav', 10, 0, 5],
      ['new.wav', 15, 0, 5],
      ['old.wav', 20, 10, 10]
    ])
    expect(new Set(result.map((c) => c.id)).size).toBe(3)
  })

  it('drops clips the new take covers completely', () => {
    expect(spans(insertClip([existing], clip('new', 0, 40)))).toEqual([['new.wav', 0, 0, 40]])
  })

  it('respects an existing offset when trimming the start', () => {
    expect(spans(insertClip([clip('old', 10, 20, 3)], clip('new', 5, 10)))).toEqual([
      ['new.wav', 5, 0, 10],
      ['old.wav', 15, 8, 15]
    ])
  })
})

describe('withRecordedClip', () => {
  it('punches the take into only the chosen track', () => {
    let p = withNewTrack(createProject('Song', 48000), 'vocal').project
    const [one, two] = p.tracks
    p = withRecordedClip(p, one.id, { file: 'a.wav', start: 0, offset: 0, duration: 30 })
    p = withRecordedClip(p, two.id, { file: 'b.wav', start: 0, offset: 0, duration: 30 })
    p = withRecordedClip(p, one.id, { file: 'c.wav', start: 10, offset: 0, duration: 5 })
    expect(spans(p.tracks[0].clips)).toEqual([
      ['a.wav', 0, 0, 10],
      ['c.wav', 10, 0, 5],
      ['a.wav', 15, 15, 15]
    ])
    expect(spans(p.tracks[1].clips)).toEqual([['b.wav', 0, 0, 30]])
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

describe('withTrackChanges', () => {
  it('changes only the named track', () => {
    const p = withNewTrack(createProject('Song', 48000), 'vocal').project
    const next = withTrackChanges(p, p.tracks[1].id, { muted: true, volume: 0.3 })
    expect(next.tracks.map((t) => [t.muted, t.volume])).toEqual([
      [false, 1],
      [true, 0.3]
    ])
  })
})

describe('createProject', () => {
  it('starts with one empty vocal track ready to record into', () => {
    const p = createProject('Song', 48000)
    expect(p.version).toBe(2)
    expect(p.tracks).toHaveLength(1)
    expect(p.tracks[0]).toMatchObject({ role: 'vocal', name: 'Vocal 1', clips: [] })
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

describe('withTrackAudio', () => {
  it('puts a single clip at the start of the track', () => {
    const p = createProject('Song', 48000)
    const id = p.tracks[0].id
    const next = withTrackAudio(p, id, 'audio/take-001.wav', 12.5)
    expect(next.tracks[0].clips).toEqual([
      { id: expect.any(String), file: 'audio/take-001.wav', start: 0, offset: 0, duration: 12.5 }
    ])
  })

  it('replaces the previous take on that track only, leaving the original untouched', () => {
    let p = withNewTrack(createProject('Song', 48000), 'vocal').project
    const [one, two] = p.tracks
    p = withTrackAudio(p, one.id, 'audio/take-001.wav', 5)
    p = withTrackAudio(p, two.id, 'audio/take-002.wav', 6)
    const again = withTrackAudio(p, one.id, 'audio/take-003.wav', 7)
    expect(again.tracks.map((t) => t.clips.map((c) => c.file))).toEqual([
      ['audio/take-003.wav'],
      ['audio/take-002.wav']
    ])
    expect(p.tracks[0].clips[0].file).toBe('audio/take-001.wav')
  })
})

describe('parseProject', () => {
  it('round-trips a saved project', () => {
    const p = withTrackAudio(createProject('Song', 48000), 'x', 'a.wav', 1)
    expect(parseProject(JSON.parse(JSON.stringify(p)))).toEqual(p)
  })

  it('migrates a version 1 project: backing track and each take become tracks', () => {
    const v1 = {
      version: 1,
      name: 'Old Song',
      sampleRate: 48000,
      backingTrack: { file: 'audio/backing-beat.mp3', name: 'beat.mp3', volume: 1 },
      tracks: [
        {
          id: 't',
          role: 'lead',
          name: 'Lead Vocal',
          volume: 1,
          pan: 0,
          muted: false,
          clips: [
            { id: 'a', file: 'audio/take-001.wav', start: 0, offset: 0, duration: 10 },
            { id: 'b', file: 'audio/take-002.wav', start: 0, offset: 0, duration: 12 }
          ]
        }
      ]
    }
    const p = parseProject(v1)
    expect(p.version).toBe(2)
    expect(p.name).toBe('Old Song')
    expect(p.tracks.map((t) => [t.role, t.name, t.clips[0]?.file])).toEqual([
      ['backing', 'Backing 1', 'audio/backing-beat.mp3'],
      ['vocal', 'Vocal 1', 'audio/take-001.wav'],
      ['vocal', 'Vocal 2', 'audio/take-002.wav']
    ])
    expect(p.tracks[0].sourceName).toBe('beat.mp3')
  })

  it('gives a migrated project with no takes an empty vocal track', () => {
    const p = parseProject({
      version: 1,
      name: 'x',
      sampleRate: 48000,
      backingTrack: null,
      tracks: []
    })
    expect(p.tracks.map((t) => t.name)).toEqual(['Vocal 1'])
  })

  it.each([null, {}, { version: 3, name: 'x', tracks: [] }, { version: 2, name: 'x' }])(
    'rejects %j',
    (data) => {
      expect(() => parseProject(data)).toThrow(/isn't a Rove project/)
    }
  )
})

describe('formatMillis', () => {
  it.each([
    [0, '.000'],
    [12.3456, '.345'],
    [0.07, '.070'],
    [-1, '.000']
  ])('%d s ends %s', (seconds, text) => {
    expect(formatMillis(seconds)).toBe(text)
  })
})

describe('formatDuration', () => {
  it.each([
    [0, '0:00'],
    [9.9, '0:09'],
    [65, '1:05'],
    [-1, '0:00']
  ])('%d s is %s', (seconds, text) => {
    expect(formatDuration(seconds)).toBe(text)
  })
})

describe('clip editing', () => {
  const setup = (clips: Clip[]): { id: string; p: Project } => {
    const p = createProject('Song', 48000)
    const id = p.tracks[0].id
    return { id, p: { ...p, tracks: [{ ...p.tracks[0], clips }] } }
  }
  const trackSpans = (p: Project): ReturnType<typeof spans> => spans(p.tracks[0].clips)

  it('moves a clip and punches out what it lands on', () => {
    const { p, id } = setup([clip('a', 0, 10), clip('b', 20, 10)])
    expect(trackSpans(moveClip(p, id, 'b', 5))).toEqual([
      ['a.wav', 0, 0, 5],
      ['b.wav', 5, 0, 10]
    ])
  })

  it('never moves a clip before the start of the song', () => {
    const { p, id } = setup([clip('a', 5, 10)])
    expect(trackSpans(moveClip(p, id, 'a', -3))).toEqual([['a.wav', 0, 0, 10]])
  })

  it('trims the start while the audio stays in place', () => {
    const { p, id } = setup([clip('a', 10, 20)])
    expect(trackSpans(trimClipStart(p, id, 'a', 14))).toEqual([['a.wav', 14, 4, 16]])
  })

  it('can un-trim the start, but not past the beginning of the file', () => {
    const { p, id } = setup([clip('a', 14, 16, 4)])
    expect(trackSpans(trimClipStart(p, id, 'a', 0))).toEqual([['a.wav', 10, 0, 20]])
  })

  it('trims the end, but not past the end of the file', () => {
    const { p, id } = setup([clip('a', 10, 20)])
    expect(trackSpans(trimClipEnd(p, id, 'a', 25, 20))).toEqual([['a.wav', 10, 0, 15]])
    expect(trackSpans(trimClipEnd(p, id, 'a', 99, 20))).toEqual([['a.wav', 10, 0, 20]])
  })

  it('keeps a sliver rather than trimming a clip away', () => {
    const { p, id } = setup([clip('a', 10, 20)])
    const [, , , duration] = trackSpans(trimClipEnd(p, id, 'a', 0, 20))[0]
    expect(duration).toBeCloseTo(MIN_CLIP_SEC)
  })

  it('splits at the playhead, keeping fades on the outer ends', () => {
    const { p, id } = setup([{ ...clip('a', 10, 20), fadeIn: 1, fadeOut: 2 }])
    const [left, right] = splitClip(p, id, 'a', 15).tracks[0].clips
    expect([left.start, left.offset, left.duration, left.fadeIn, left.fadeOut]).toEqual([
      10, 0, 5, 1, 0
    ])
    expect([right.start, right.offset, right.duration, right.fadeIn, right.fadeOut]).toEqual([
      15, 5, 15, 0, 2
    ])
    expect(left.id).not.toBe(right.id)
  })

  it('ignores a split outside the clip', () => {
    const { p, id } = setup([clip('a', 10, 20)])
    expect(trackSpans(splitClip(p, id, 'a', 40))).toEqual([['a.wav', 10, 0, 20]])
  })

  it('clamps fades to the clip length', () => {
    const { p, id } = setup([clip('a', 0, 4)])
    const c = setClipFades(p, id, 'a', { fadeIn: 10, fadeOut: -1 }).tracks[0].clips[0]
    expect([c.fadeIn, c.fadeOut]).toEqual([4, 0])
  })

  it('deletes a clip', () => {
    const { p, id } = setup([clip('a', 0, 4), clip('b', 5, 4)])
    expect(trackSpans(deleteClip(p, id, 'a'))).toEqual([['b.wav', 5, 0, 4]])
  })

  it('fills in unknown clip lengths once the audio is decoded', () => {
    const { p } = setup([clip('a', 0, 0)])
    expect(trackSpans(withKnownDurations(p, { 'a.wav': 42 }))).toEqual([['a.wav', 0, 0, 42]])
    expect(withKnownDurations(p, {})).toBe(p)
  })
})

describe('tuning settings', () => {
  it('gives tracks saved before tuning existed tuning switched off', () => {
    const project = createProject('Song', 48000)
    const [track] = project.tracks
    const older: Partial<PolishSettings> = { ...polishOf(track) }
    delete older.tuning
    expect(polishOf({ ...track, polish: older as PolishSettings }).tuning).toBe(0)
  })

  it('stores the song key, or clears it for any note', () => {
    const project = withSongKey(createProject('Song', 48000), { tonic: 9, mode: 'minor' })
    expect(project.key).toEqual({ tonic: 9, mode: 'minor' })
    expect(withSongKey(project, null).key).toBeNull()
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

describe('music speed and key', () => {
  /** A song with music at 0–10 s (from 2 s into its file) and a vocal at 4 s. */
  function withMusic(): Project {
    const backing = withNewTrack(createProject('Song', 48000), 'backing', { sourceName: 'a.mp3' })
    return {
      ...backing.project,
      tracks: backing.project.tracks.map((t) =>
        t.role === 'backing'
          ? { ...t, clips: [{ ...clip('m', 0, 10, 2), fadeOut: 1 }] }
          : { ...t, clips: [clip('v', 4, 3)] }
      )
    }
  }
  const music = (p: Project) => p.tracks.find((t) => t.role === 'backing')!.clips[0]
  const vocal = (p: Project) => p.tracks.find((t) => t.role === 'vocal')!.clips[0]

  it('plays music at its own speed and key until changed', () => {
    expect(musicOf(withMusic())).toMatchObject({ speed: 1, semitones: 0 })
  })

  it('makes the music shorter when it speeds up, and leaves vocals where they are', () => {
    const faster = withMusicSpeed(withMusic(), 1.25)
    expect(musicOf(faster).speed).toBe(1.25)
    expect(music(faster)).toMatchObject({ start: 0, offset: 1.6, duration: 8, fadeOut: 0.8 })
    expect(vocal(faster)).toEqual(vocal(withMusic()))
  })

  it('comes back to the same clip after speeding up and slowing down again', () => {
    const back = withMusicSpeed(withMusicSpeed(withMusic(), 1.25), 1)
    expect(music(back)).toMatchObject({ start: 0, offset: 2, duration: 10 })
  })

  it('keeps the speed within a range that still sounds natural', () => {
    expect(musicOf(withMusicSpeed(withMusic(), 9)).speed).toBe(MUSIC_SPEED_RANGE.max)
  })

  it('moves the song key along with the music', () => {
    const inA = withSongKey(withMusic(), { tonic: 9, mode: 'minor' })
    const up = withMusicPitch(inA, 3)
    expect(musicOf(up).semitones).toBe(3)
    expect(up.key).toEqual({ tonic: 0, mode: 'minor' })
    expect(withMusicPitch(up, 0).key).toEqual({ tonic: 9, mode: 'minor' })
  })
})

describe('music tone and click', () => {
  it('plays music with a flat tone and no click until changed', () => {
    expect(musicOf(createProject('Song', 48000))).toMatchObject({
      bassDb: 0,
      brightnessDb: 0,
      clickOn: false
    })
  })

  it('reads songs saved before tone existed as flat', () => {
    const older = { ...createProject('Song', 48000), music: { speed: 1.1, semitones: 0 } }
    expect(musicOf(older as Project)).toMatchObject({ speed: 1.1, bassDb: 0, clickOn: false })
  })

  it('keeps bass and brightness within a safe range', () => {
    const song = withMusicTone(createProject('Song', 48000), { bassDb: 20, brightnessDb: -3 })
    expect(musicOf(song)).toMatchObject({ bassDb: MUSIC_TONE_MAX_DB, brightnessDb: -3 })
  })

  it('sets the metronome volume between silent and full', () => {
    expect(musicOf(withClick(createProject('Song', 48000), 1.5)).click).toBe(1)
  })

  it('switches the metronome on and off, keeping its volume', () => {
    const on = withClickOn(withClick(createProject('Song', 48000), 0.4), true)
    expect(musicOf(on)).toMatchObject({ clickOn: true, click: 0.4 })
  })
})

describe('removing vocals', () => {
  const song = (): Project => {
    const project = createProject('Song', 48000)
    const { project: withBacking, track } = withNewTrack(project, 'backing')
    return withTrackAudio(withBacking, track.id, 'audio/song.mp3', 180)
  }
  const backing = (p: Project) => p.tracks.find((t) => t.role === 'backing')!

  it('plays the instrumental in place of the song, remembering the original', () => {
    const p = song()
    const removed = withoutVocals(p, backing(p).id, {
      'audio/song.mp3': 'audio/song (no vocals).wav'
    })
    expect(backing(removed).clips[0]).toMatchObject({
      file: 'audio/song (no vocals).wav',
      withVocals: 'audio/song.mp3'
    })
  })

  it('puts the original song back', () => {
    const p = song()
    const id = backing(p).id
    const back = withVocalsBack(withoutVocals(p, id, { 'audio/song.mp3': 'audio/x.wav' }), id)
    expect(backing(back).clips[0].file).toBe('audio/song.mp3')
    expect(backing(back).clips[0].withVocals).toBeUndefined()
  })
})
