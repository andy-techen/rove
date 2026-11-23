import { t } from '@shared/copy'
import type { MixdownTrack } from '../../audio/export/exportMix'
import { TrackMix } from '../../audio/mix/mixer'
import { polishParams } from '../../audio/polish/polish'
import {
  Project,
  TrackRole,
  formatDuration,
  musicOf,
  polishOf,
  startingVolume,
  tracksOf
} from './project'
import { ProcessedAudio, bufferFor } from '../processing/processedAudio'

// Edges this close to the playhead count as "here", so a jump moves on to the next one.
const EDGE_TOLERANCE_SEC = 0.001

/** What the timeline draws for one clip. */
export interface ClipShape {
  id: string
  start: number
  offset: number
  duration: number
  fadeIn: number
  fadeOut: number
  audio: AudioBuffer | null
  /** Joined to the clip before / after it in the lane: same group, so drawn as one. */
  joinedBefore: boolean
  joinedAfter: boolean
}

/** Grouped clips next to each other in a lane, drawn as one block behind them. */
export interface ClipBlock {
  start: number
  end: number
  clipIds: string[]
}

/** What the timeline draws for one track lane. */
export interface LaneView {
  id: string
  role: TrackRole
  name: string
  detail: string
  /** True when the track came from an imported file rather than a recorded take. */
  imported: boolean
  volume: number
  /** Where double-clicking the volume returns: the track's starting volume. */
  startVolume: number
  pan: number
  muted: boolean
  clips: ClipShape[]
  blocks: ClipBlock[]
}

// Imported backing files are copied in as "backing-<original name>".
const IMPORT_PREFIX = /^backing-/
const EXTENSION = /\.[^.]+$/

/** A backing file's name as the singer knows it: no import prefix or extension. */
export function backingTitle(fileName: string): string {
  return fileName.replace(IMPORT_PREFIX, '').replace(EXTENSION, '')
}

/** Backing tracks first, then vocals, each with the summary its header shows. */
export function selectLanes(
  project: Project,
  audio: Record<string, AudioBuffer>,
  processed: ProcessedAudio = {}
): LaneView[] {
  return [...tracksOf(project, 'backing'), ...tracksOf(project, 'vocal')].map((track) => {
    const part = t(track.part === 'harmony' ? 'timeline.harmony' : 'timeline.lead')
    const sung = track.clips.reduce((sum, c) => sum + c.duration, 0)
    return {
      id: track.id,
      role: track.role,
      name: track.name,
      detail:
        track.role === 'backing'
          ? track.sourceName
            ? backingTitle(track.sourceName)
            : track.clips.length
              ? t('timeline.recordedDetail', { length: formatDuration(sung) })
              : t('timeline.recorded')
          : track.clips.length
            ? t('timeline.vocalDetail', { part, length: formatDuration(sung) })
            : part,
      imported: !!track.sourceName,
      volume: track.volume,
      startVolume: startingVolume(track.role, track.part, !!track.sourceName),
      pan: track.pan,
      muted: track.muted,
      ...joinGroups(
        track.clips.map((c) => ({
          id: c.id,
          start: c.start,
          offset: c.offset,
          duration: c.duration,
          group: c.group,
          fadeIn: c.fadeIn ?? 0,
          fadeOut: c.fadeOut ?? 0,
          audio: bufferFor(audio, processed, track.id, c.file) ?? null
        }))
      )
    }
  })
}

/**
 * Grouped clips read as one clip: each run of clips in a lane that share a group (with
 * nothing else between them) becomes a block, and its clips are marked as joined.
 */
export function joinGroups<C extends { id: string; start: number; duration: number }>(
  clips: (C & { group?: string })[]
): { clips: (C & { joinedBefore: boolean; joinedAfter: boolean })[]; blocks: ClipBlock[] } {
  const sorted = [...clips].sort((a, b) => a.start - b.start)
  const blocks: ClipBlock[] = []
  const joined = sorted.map(({ group, ...clip }, i) => {
    const prev = sorted[i - 1]?.group
    const next = sorted[i + 1]?.group
    const joinedBefore = group !== undefined && prev === group
    const joinedAfter = group !== undefined && next === group
    const end = clip.start + clip.duration
    if (joinedBefore) {
      const block = blocks[blocks.length - 1]
      block.end = end
      block.clipIds.push(clip.id)
    } else if (joinedAfter) blocks.push({ start: clip.start, end, clipIds: [clip.id] })
    return { ...(clip as unknown as C), joinedBefore, joinedAfter }
  })
  return { clips: joined, blocks }
}

/** Recording needs a song open and either a backing track or the choice to sing without one. */
export function hasMusicChoice(project: Project | undefined, skipBacking: boolean): boolean {
  return !!project && (tracksOf(project, 'backing').length > 0 || skipBacking)
}

/** Where the song ends: the end of its last clip. */
export function songEnd(project: Project): number {
  return Math.max(0, ...project.tracks.flatMap((t) => t.clips.map((c) => c.start + c.duration)))
}

function clipEdges(project: Project, trackId: string | null): number[] {
  return project.tracks
    .filter((t) => trackId === null || t.id === trackId)
    .flatMap((t) => t.clips.flatMap((c) => [c.start, c.start + c.duration]))
}

/**
 * The nearest clip start or end before the playhead, on one track (or every track).
 * From inside a clip that's its start; pressed again, the end of the clip before it.
 */
export function edgeBefore(project: Project, position: number, trackId: string | null): number {
  const earlier = clipEdges(project, trackId).filter((e) => e < position - EDGE_TOLERANCE_SEC)
  return earlier.length ? Math.max(...earlier) : 0
}

/** The nearest clip start or end after the playhead; stays put when there's none. */
export function edgeAfter(project: Project, position: number, trackId: string | null): number {
  const later = clipEdges(project, trackId).filter((e) => e > position + EDGE_TOLERANCE_SEC)
  return later.length ? Math.min(...later) : position
}

// An export runs at least this far past the last clip, so nothing ends on a hard cut.
const MIN_EXPORT_TAIL_SEC = 0.5

/**
 * What an export mixes: every track as it plays now, and long enough after the last
 * clip for the longest reverb to ring out. Clips whose audio isn't loaded are skipped.
 */
export function mixdownOf(
  project: Project,
  audio: Record<string, AudioBuffer>,
  processed: ProcessedAudio = {}
): { tracks: MixdownTrack[]; lengthSec: number } {
  const mixes = trackMixes(project)
  const tracks = project.tracks.map((track, i) => ({
    ...mixes[i],
    clips: track.clips.flatMap((c) => {
      const buffer = bufferFor(audio, processed, track.id, c.file)
      if (!buffer) return []
      return [{ ...c, buffer, duration: c.duration || buffer.duration }]
    })
  }))
  const reverbTails = project.tracks
    .filter((t) => t.role === 'vocal' && !t.muted && polishOf(t).enabled)
    .map((t) => polishParams(polishOf(t)).reverbDecaySec)
  return { tracks, lengthSec: songEnd(project) + Math.max(MIN_EXPORT_TAIL_SEC, ...reverbTails) }
}

/**
 * How each track is mixed, in project order: vocals with their polish, music with the
 * song's bass and brightness. Playback and export both use this, so they sound alike.
 */
export function trackMixes(project: Project): ({ id: string } & TrackMix)[] {
  const { bassDb, brightnessDb } = musicOf(project)
  return project.tracks.map((track) => ({
    id: track.id,
    role: track.role,
    volume: track.volume,
    pan: track.pan,
    muted: track.muted,
    polish: track.role === 'vocal' ? polishOf(track) : undefined,
    tone: track.role === 'backing' ? { bassDb, brightnessDb } : undefined
  }))
}

/** Whether there's anything to export yet. */
export const canExportSong = (project: Project | undefined): boolean =>
  !!project && songEnd(project) > 0

/**
 * What playback has lined up: every track's clips. Mix changes (volume, pan, mute,
 * polish) are left out because the mixer applies them live; a change in this key means
 * playback has to start again to be heard.
 */
export const playbackKey = (project: Project): string =>
  JSON.stringify(project.tracks.map((track) => [track.id, track.role, track.clips]))

/**
 * Where a paste lands: the picked track if it's the same kind as the copy, else the
 * copy's own track. Vocals and backing tracks don't mix: backing tracks follow the music's
 * speed and key, which would change a pasted vocal.
 */
export function pasteTarget(
  project: Project,
  fromTrackId: string,
  pickedTrackId: string | null
): string {
  const role = (id: string | null): TrackRole | undefined =>
    project.tracks.find((t) => t.id === id)?.role
  return pickedTrackId && role(pickedTrackId) === role(fromTrackId) ? pickedTrackId : fromTrackId
}
