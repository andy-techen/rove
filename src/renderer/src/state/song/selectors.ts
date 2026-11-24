import { t } from '@shared/copy'
import type { MixdownTrack } from '../../audio/export/exportMix'
import { TrackMix } from '../../audio/mix/mixer'
import { polishParams } from '../../audio/polish/polish'
import {
  Project,
  Track,
  TrackRole,
  chordsTracksOf,
  formatDuration,
  instrumentOf,
  musicOf,
  polishOf,
  startingVolume,
  tracksOf
} from './project'
import { ProcessedAudio, bufferFor } from '../processing/processedAudio'
import { beatCells, beatName } from '../chords/beats'
import { ChartPlace, ChordPart, chartCells, instrumentalTimeline } from '../chords/chart'
import { chordName } from '../chords/noteNames'

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
  /** A chords lane shows its chords instead of clips. */
  chords?: ChordBlock[]
}

/** One chord on a chords lane, named as it plays, over every bar it rings through. */
export interface ChordBlock {
  start: number
  end: number
  /** Empty before the first chord. */
  name: string
  /** The bars (or split halves) it covers: the one it's written in, then any kept. */
  cells: ChordCellView[]
}

/** A bar inside a chord block, which can be clicked or dragged on its own. */
export interface ChordCellView {
  start: number
  end: number
  /** A bar left empty, keeping the chord before it ringing. */
  carried: boolean
  /** Where in the chart it's written, for opening it there. */
  place: ChartPlace
}
// Imported backing files are copied in as "backing-<original name>".
const IMPORT_PREFIX = /^backing-/
const EXTENSION = /\.[^.]+$/

/** A backing file's name as the singer knows it: no import prefix or extension. */
export function backingTitle(fileName: string): string {
  return fileName.replace(IMPORT_PREFIX, '').replace(EXTENSION, '')
}

/** The music first (files and chords, in the singer's order), then vocals. */
const laneOrder = (project: Project): Track[] => [
  ...project.tracks.filter((t) => t.role !== 'vocal'),
  ...tracksOf(project, 'vocal')
]

/**
 * What a chords lane shows: each chord as one block, running on through the bars that
 * keep it ringing, with every bar inside it still there to click.
 */
function chordBlocks(project: Project, track: Track): ChordBlock[] {
  if (instrumentOf(track) === 'beats') return beatBlocks(project, track)
  if (!track.chart) return []
  const blocks: ChordBlock[] = []
  for (const cell of chartCells(project, track.chart)) {
    const view = { start: cell.start, end: cell.end, carried: cell.carried, place: cell.place }
    const last = blocks.at(-1)
    if (cell.carried && last) {
      last.end = cell.end
      last.cells.push(view)
    } else {
      const name = cell.chord ? chordName(cell.chord) : ''
      blocks.push({ start: cell.start, end: cell.end, name, cells: [view] })
    }
  }
  return blocks
}

/** What a beats lane shows: each run of bars playing the same part as one block. */
function beatBlocks(project: Project, track: Track): ChordBlock[] {
  const parts = track.beats?.parts ?? []
  const blocks: ChordBlock[] = []
  for (const cell of track.beats ? beatCells(project, track.beats) : []) {
    const same = cell.place.bar > 0 && parts[cell.place.bar - 1] === cell.part
    // Each bar plays its part afresh, so none is "kept" even inside a longer block.
    const view = { start: cell.start, end: cell.end, carried: false, place: cell.place }
    const last = blocks.at(-1)
    if (last && same) {
      last.end = cell.end
      last.cells.push(view)
    } else {
      blocks.push({
        start: cell.start,
        end: cell.end,
        name: beatName(track.beats!, cell.part),
        cells: [view]
      })
    }
  }
  return blocks
}

/** Music tracks first, then vocals, each with the summary its header shows. */
export function selectLanes(
  project: Project,
  audio: Record<string, AudioBuffer>,
  processed: ProcessedAudio = {}
): LaneView[] {
  return laneOrder(project).map((track) => {
    if (track.role === 'chords') {
      return {
        id: track.id,
        role: track.role,
        name: track.name,
        detail: t(
          instrumentOf(track) === 'beats' ? 'timeline.detailBeats' : 'timeline.detailGuitar'
        ),
        imported: false,
        volume: track.volume,
        startVolume: startingVolume(track.role),
        pan: track.pan,
        muted: track.muted,
        clips: [],
        blocks: [],
        chords: chordBlocks(project, track)
      }
    }
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

/** Recording needs a song open and either some music or the choice to sing without it. */
export function hasMusicChoice(project: Project | undefined, skipBacking: boolean): boolean {
  return (
    !!project &&
    (tracksOf(project, 'backing').length > 0 || chordsTracksOf(project).length > 0 || skipBacking)
  )
}

/** Where the song ends: the end of its last clip, or of the chords when they play. */
export function songEnd(project: Project): number {
  const chords = chordsTracksOf(project).map((t) => instrumentalTimeline(project, t)?.endSec ?? 0)
  return Math.max(
    0,
    ...chords,
    ...project.tracks.flatMap((t) => t.clips.map((c) => c.start + c.duration))
  )
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
  processed: ProcessedAudio = {},
  parts: ChordPart[] = []
): { tracks: MixdownTrack[]; lengthSec: number } {
  const mixes = trackMixes(project)
  const tracks = project.tracks.map((track, i) => ({
    ...mixes[i],
    clips: [
      ...track.clips.flatMap((c) => {
        const buffer = bufferFor(audio, processed, track.id, c.file)
        if (!buffer) return []
        return [{ ...c, buffer, duration: c.duration || buffer.duration }]
      }),
      ...partClips(parts, track.id)
    ]
  }))
  const reverbTails = project.tracks
    .filter((t) => t.role === 'vocal' && !t.muted && polishOf(t).enabled)
    .map((t) => polishParams(polishOf(t)).reverbDecaySec)
  const tail = songEnd(project) + Math.max(MIN_EXPORT_TAIL_SEC, ...reverbTails)
  // The last chord rings on past the chart's end.
  const ringing = parts.map((p) => p.start + p.buffer.duration)
  return { tracks, lengthSec: Math.max(tail, ...ringing) }
}

/** A chords track's rendered sound, as the one clip it plays. */
export const partClips = (
  parts: ChordPart[],
  trackId: string
): { buffer: AudioBuffer; start: number; offset: number; duration: number }[] =>
  parts
    .filter((p) => p.trackId === trackId)
    .map((p) => ({ buffer: p.buffer, start: p.start, offset: 0, duration: p.buffer.duration }))

/**
 * How each track is mixed, in project order: vocals with their polish, music with the
 * song's bass and brightness. Playback and export both use this, so they sound alike.
 */
export function trackMixes(project: Project): ({ id: string } & TrackMix)[] {
  const { bassDb, brightnessDb } = musicOf(project)
  return project.tracks.map((track) => ({
    id: track.id,
    // The chords are music: mixed with the music's bass and brightness.
    role: track.role === 'vocal' ? 'vocal' : 'backing',
    volume: track.volume,
    pan: track.pan,
    muted: track.muted,
    polish: track.role === 'vocal' ? polishOf(track) : undefined,
    tone: track.role === 'vocal' ? undefined : { bassDb, brightnessDb }
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
