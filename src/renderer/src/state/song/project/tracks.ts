import { moveItem } from '../../tabs/tabOrder'
import { SongLyrics } from '../../lyrics/lyrics'
import { PolishSettings, defaultPolish } from '../../../audio/polish/polish'
import {
  HARMONY_PAN,
  HARMONY_VOLUME,
  LYRICS_OFFSET_MAX_SEC,
  MASTERED_MUSIC_VOLUME,
  PROJECT_VERSION,
  TRACK_NAME_MAX_LENGTH
} from './constants'
import type { Project, Track, TrackRole, VocalPart } from './types'

const ROLE_LABEL: Record<TrackRole, string> = {
  vocal: 'Vocal',
  backing: 'Backing',
  // Guitar, piano or beats: to the singer it's all backing, numbered together.
  chords: 'Backing'
}

export function createProject(
  name: string,
  sampleRate: number,
  artist?: string,
  note?: string
): Project {
  const trimmed = artist?.trim()
  const trimmedNote = note?.trim()
  const base: Project = { version: PROJECT_VERSION, name, sampleRate, tracks: [] }
  if (trimmed) base.artist = trimmed
  if (trimmedNote) base.note = trimmedNote
  return withNewTrack(base, 'vocal').project
}

export function tracksOf(project: Project, role: TrackRole): Track[] {
  return project.tracks.filter((t) => t.role === role)
}

/** Whether two tracks sit together: vocals with vocals, music (files or chords) with music. */
export const sameGroup = (a: TrackRole, b: TrackRole): boolean =>
  (a === 'vocal') === (b === 'vocal')

export const mapTrack = (
  project: Project,
  trackId: string,
  change: (track: Track) => Track
): Project => ({
  ...project,
  tracks: project.tracks.map((track) => (track.id === trackId ? change(track) : track))
})

/** The volume a track starts at, for its role; double-clicking volume returns here. */
export function startingVolume(role: TrackRole, part?: VocalPart, fromFile = false): number {
  // Music recorded here isn't mastered, so it starts at full volume like a lead.
  if (role === 'backing') return fromFile ? MASTERED_MUSIC_VOLUME : 1
  // The chords are rendered at a level that already sits under a voice.
  if (role === 'chords') return 1
  return part === 'harmony' ? HARMONY_VOLUME : 1
}

/**
 * Whether Rove may set the music's volume to suit a take on this track: a lead vocal,
 * over imported music nobody has turned up or down yet. Once the singer (or Rove) sets
 * it, it stays theirs.
 */
export function canBalanceMusic(project: Project, vocalTrackId: string): boolean {
  const vocal = project.tracks.find((t) => t.id === vocalTrackId)
  if (vocal?.role !== 'vocal' || vocal.part === 'harmony') return false
  const music = project.tracks.filter((t) => t.role === 'backing')
  const untouched = startingVolume('backing', undefined, true)
  return music.length > 0 && music.every((t) => !!t.sourceName && t.volume === untouched)
}

/**
 * Whether Rove may offer to set this harmony's volume against the lead: only while it's
 * where it started. Once the singer (or Rove) sets it, it stays theirs.
 */
export function canBalanceHarmony(project: Project, trackId: string): boolean {
  const track = project.tracks.find((t) => t.id === trackId)
  return (
    track?.role === 'vocal' &&
    track.part === 'harmony' &&
    track.volume === startingVolume('vocal', 'harmony')
  )
}

/** Sets every music file's volume (the backing tracks). */
export const withMusicVolume = (project: Project, volume: number): Project => ({
  ...project,
  tracks: project.tracks.map((t) => (t.role === 'backing' ? { ...t, volume } : t))
})

function defaultMix(
  project: Project,
  role: TrackRole,
  part?: VocalPart,
  fromFile = false
): { volume: number; pan: number } {
  const volume = startingVolume(role, part, fromFile)
  if (role !== 'vocal' || part !== 'harmony') return { volume, pan: 0 }
  const harmonies = project.tracks.filter((t) => t.part === 'harmony').length
  return { volume, pan: harmonies % 2 === 0 ? -HARMONY_PAN : HARMONY_PAN }
}

/** Adds an empty track named after the next free number for its role ("Vocal 3"). */
export function withNewTrack(
  project: Project,
  role: TrackRole,
  opts: { sourceName?: string; part?: VocalPart } = {}
): { project: Project; track: Track } {
  const label = ROLE_LABEL[role]
  const used = project.tracks.map((t) =>
    Number(new RegExp(`^${label} (\\d+)$`).exec(t.name)?.[1] ?? 0)
  )
  const part = role === 'vocal' ? (opts.part ?? 'lead') : undefined
  const track: Track = {
    id: crypto.randomUUID(),
    role,
    ...(part ? { part } : {}),
    name: `${label} ${Math.max(0, ...used) + 1}`,
    ...(opts.sourceName ? { sourceName: opts.sourceName } : {}),
    ...defaultMix(project, role, part, !!opts.sourceName),
    ...(part ? { polish: defaultPolish(part) } : {}),
    muted: false,
    clips: []
  }
  return { project: { ...project, tracks: [...project.tracks, track] }, track }
}

/**
 * Takes a track out of the song. Its recordings stay in the song folder, so undo can
 * bring it back whole.
 */
export function withoutTracks(project: Project, trackIds: string[]): Project {
  return { ...project, tracks: project.tracks.filter((t) => !trackIds.includes(t.id)) }
}

/** The song with a track renamed; a blank name leaves it as it was. */
export function withTrackName(project: Project, trackId: string, name: string): Project {
  const trimmed = name.trim().slice(0, TRACK_NAME_MAX_LENGTH)
  if (!trimmed) return project
  return mapTrack(project, trackId, (t) => ({ ...t, name: trimmed }))
}

/**
 * The song with a track moved to place `to` among the tracks of its own kind. Vocals and
 * backing tracks are listed in separate groups, so each keeps to its own.
 */
export function moveTrack(project: Project, trackId: string, to: number): Project {
  const track = project.tracks.find((t) => t.id === trackId)
  if (!track) return project
  const inGroup = (t: Track): boolean => sameGroup(t.role, track.role)
  const group = project.tracks.filter(inGroup)
  const reordered = moveItem(group, group.indexOf(track), to)
  let next = 0
  return {
    ...project,
    tracks: project.tracks.map((t) => (inGroup(t) ? reordered[next++] : t))
  }
}

export function polishOf(track: Track): PolishSettings {
  // A control added in a later version starts at its default on songs saved before it.
  return { ...defaultPolish(track.part ?? 'lead'), ...track.polish }
}

export function withTrackPolish(
  project: Project,
  trackId: string,
  polish: PolishSettings
): Project {
  return mapTrack(project, trackId, (t) => ({ ...t, polish }))
}

export function withTrackChanges(
  project: Project,
  trackId: string,
  changes: Partial<Pick<Track, 'volume' | 'pan' | 'muted' | 'part'>>
): Project {
  return mapTrack(project, trackId, (t) => {
    const next = { ...t, ...changes }
    // A suggestion was made for one part; the other part sits differently in the mix.
    if (changes.part && changes.part !== (t.part ?? 'lead')) delete next.polishSuggestion
    return next
  })
}

/**
 * Makes a vocal track a lead or a harmony. Volume, pan and Polish the singer hasn't
 * changed move to the new part's starting settings; anything they set stays theirs.
 */
export function withVocalPart(project: Project, trackId: string, part: VocalPart): Project {
  const track = project.tracks.find((t) => t.id === trackId)
  if (track?.role !== 'vocal') return project
  const was = track.part ?? 'lead'
  if (was === part) return project
  const others = { ...project, tracks: project.tracks.filter((t) => t.id !== trackId) }
  const fresh = defaultMix(others, 'vocal', part)
  const untouched = defaultMix(others, 'vocal', was)
  const samePolish = JSON.stringify(polishOf(track)) === JSON.stringify(defaultPolish(was))
  const changed = withTrackChanges(project, trackId, {
    part,
    ...(track.volume === untouched.volume ? { volume: fresh.volume } : {}),
    // A harmony's pan alternates sides, so any starting side counts as untouched.
    ...(Math.abs(track.pan) === Math.abs(untouched.pan) ? { pan: fresh.pan } : {})
  })
  return samePolish ? withTrackPolish(changed, trackId, defaultPolish(part)) : changed
}

export function withLyrics(project: Project, lyrics: SongLyrics | null): Project {
  return { ...project, lyrics }
}

/** Moves every lyric line `bySec` later (negative: earlier), within a sensible range. */
export function nudgeLyrics(project: Project, bySec: number): Project {
  if (!project.lyrics) return project
  const offsetSec = Math.max(
    -LYRICS_OFFSET_MAX_SEC,
    Math.min(LYRICS_OFFSET_MAX_SEC, project.lyrics.offsetSec + bySec)
  )
  return { ...project, lyrics: { ...project.lyrics, offsetSec } }
}
