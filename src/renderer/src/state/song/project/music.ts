// Music speed, key and tone. These apply to backing tracks only: vocals are sung to the
// music as it plays, so they keep their own speed and pitch.
import { transposeKey } from '../../../audio/pitch/key'
import {
  MUSIC_SEMITONES_MAX,
  MUSIC_SPEED_RANGE,
  MUSIC_TONE_MAX_DB,
  ORIGINAL_MUSIC,
  TIME_PRECISION
} from './constants'
import { mapTrack } from './tracks'
import type { MusicSettings, Project, Track } from './types'

const roundTime = (sec: number): number => Math.round(sec * TIME_PRECISION) / TIME_PRECISION

// Settings the song hasn't changed play as recorded.
export const musicOf = (project: Project): MusicSettings => ({
  ...ORIGINAL_MUSIC,
  ...project.music
})

const clampTone = (db: number): number =>
  Math.max(-MUSIC_TONE_MAX_DB, Math.min(MUSIC_TONE_MAX_DB, db))

/** Changes the music's bass or brightness. */
export function withMusicTone(
  project: Project,
  tone: Partial<Pick<MusicSettings, 'bassDb' | 'brightnessDb'>>
): Project {
  const music = musicOf(project)
  return {
    ...project,
    music: {
      ...music,
      bassDb: clampTone(tone.bassDb ?? music.bassDb),
      brightnessDb: clampTone(tone.brightnessDb ?? music.brightnessDb)
    }
  }
}

export function withClickOn(project: Project, clickOn: boolean): Project {
  return { ...project, music: { ...musicOf(project), clickOn } }
}

export function withClick(project: Project, level: number): Project {
  return { ...project, music: { ...musicOf(project), click: Math.max(0, Math.min(1, level)) } }
}

/**
 * Plays the music faster or slower. Its clips are measured in time as played, so they
 * shrink or grow with it (their audio is the sped-up copy); vocals stay put.
 */
export function withMusicSpeed(project: Project, speed: number): Project {
  const music = musicOf(project)
  const next = Math.max(MUSIC_SPEED_RANGE.min, Math.min(MUSIC_SPEED_RANGE.max, speed))
  const scale = (sec: number): number => roundTime((sec * music.speed) / next)
  return {
    ...project,
    music: { ...music, speed: next },
    tracks: project.tracks.map((t) =>
      t.role !== 'backing'
        ? t
        : {
            ...t,
            clips: t.clips.map((c) => ({
              ...c,
              start: scale(c.start),
              offset: scale(c.offset),
              duration: scale(c.duration),
              ...(c.fadeIn ? { fadeIn: scale(c.fadeIn) } : {}),
              ...(c.fadeOut ? { fadeOut: scale(c.fadeOut) } : {})
            }))
          }
    )
  }
}

/** Moves the music to a new key; the song key that tuning pulls toward moves with it. */
export function withMusicPitch(project: Project, semitones: number): Project {
  const music = musicOf(project)
  const next = Math.round(Math.max(-MUSIC_SEMITONES_MAX, Math.min(MUSIC_SEMITONES_MAX, semitones)))
  const shift = next - music.semitones
  const key = project.key && transposeKey(project.key, shift)
  return { ...project, key, music: { ...music, semitones: next } }
}

/** The backing track plays instrumentals in place of its songs, keeping the songs for later. */
export function withoutVocals(
  project: Project,
  trackId: string,
  instrumentals: Record<string, string>
): Project {
  return mapTrack(project, trackId, (track) => ({
    ...track,
    clips: track.clips.map((clip) =>
      clip.file in instrumentals
        ? { ...clip, file: instrumentals[clip.file], withVocals: clip.file }
        : clip
    )
  }))
}

/** The backing track plays its original songs again. */
export function withVocalsBack(project: Project, trackId: string): Project {
  return mapTrack(project, trackId, (track) => ({
    ...track,
    clips: track.clips.map(({ withVocals, ...clip }) =>
      withVocals ? { ...clip, file: withVocals } : clip
    )
  }))
}

/** Every clip of the track plays an instrumental made from its song. */
export const vocalsRemoved = (track: Track): boolean =>
  track.clips.length > 0 && track.clips.every((clip) => clip.withVocals !== undefined)
