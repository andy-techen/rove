import { describe, expect, it } from 'vitest'
import { withTrackAudio } from './clips'
import { MUSIC_SPEED_RANGE, MUSIC_TONE_MAX_DB } from './constants'
import {
  musicOf,
  withClick,
  withClickOn,
  withMusicPitch,
  withMusicSpeed,
  withMusicTone,
  withoutVocals,
  withVocalsBack
} from './music'
import { createProject, withNewTrack } from './tracks'
import type { Clip, Project } from './types'

const clip = (id: string, start: number, duration: number, offset = 0): Clip => ({
  id,
  file: `${id}.wav`,
  start,
  offset,
  duration
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
    const inA = { ...withMusic(), key: { tonic: 9, mode: 'minor' } as const }
    const up = withMusicPitch(inA, 3)
    expect(musicOf(up).semitones).toBe(3)
    expect(up.key).toEqual({ tonic: 0, mode: 'minor' })
    expect(withMusicPitch(up, 0).key).toEqual({ tonic: 9, mode: 'minor' })
  })
})

describe('music tone and click', () => {
  it('keeps bass and brightness within a safe range', () => {
    const song = withMusicTone(createProject('Song', 48000), { bassDb: 20, brightnessDb: -3 })
    expect(musicOf(song)).toMatchObject({ bassDb: MUSIC_TONE_MAX_DB, brightnessDb: -3 })
  })

  it('keeps the metronome volume between silent and full, and keeps it when switched on', () => {
    expect(musicOf(withClick(createProject('Song', 48000), 1.5)).click).toBe(1)
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
