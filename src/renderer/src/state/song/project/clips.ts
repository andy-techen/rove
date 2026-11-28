// Clip editing. Every edit changes only clip windows; audio files are untouched.
import { MIN_CLIP_SEC } from './constants'
import { mapTrack } from './tracks'
import type { Clip, Project, Track } from './types'

const clipEnd = (c: Clip): number => c.start + c.duration

/**
 * Lays a new clip over a track like punching in on tape: whatever it covers is
 * trimmed away (or split around it), everything outside it is kept. Source
 * files are never touched; only the clip windows into them change.
 */
export function insertClip(clips: Clip[], added: Clip): Clip[] {
  const from = added.start
  const to = clipEnd(added)
  const kept: Clip[] = []
  for (const c of clips) {
    const s = c.start
    const e = clipEnd(c)
    if (e <= from || s >= to) {
      kept.push(c)
    } else if (s < from && e > to) {
      kept.push({ ...c, duration: from - s })
      kept.push({
        ...c,
        id: crypto.randomUUID(),
        start: to,
        offset: c.offset + (to - s),
        duration: e - to
      })
    } else if (s < from) {
      kept.push({ ...c, duration: from - s })
    } else if (e > to) {
      kept.push({ ...c, start: to, offset: c.offset + (to - s), duration: e - to })
    }
    // Otherwise the new clip covers it completely and it drops out.
  }
  return [...kept, added].sort((a, b) => a.start - b.start)
}

export function withRecordedClip(
  project: Project,
  trackId: string,
  take: Omit<Clip, 'id'> & { id?: string }
): Project {
  const clip: Clip = { ...take, id: take.id ?? crypto.randomUUID() }
  return mapTrack(project, trackId, (t) => ({ ...t, clips: insertClip(t.clips, clip) }))
}

/** Replaces a track's audio with one file from the top of the song (backing imports). */
export function withTrackAudio(
  project: Project,
  trackId: string,
  file: string,
  duration: number,
  start = 0
): Project {
  const clip: Clip = { id: crypto.randomUUID(), file, start, offset: 0, duration }
  return mapTrack(project, trackId, (t) => ({ ...t, clips: [clip] }))
}

function mapClip(
  project: Project,
  trackId: string,
  clipId: string,
  change: (clip: Clip, track: Track) => Clip[]
): Project {
  return mapTrack(project, trackId, (t) => ({
    ...t,
    clips: t.clips
      .flatMap((c) => (c.id === clipId ? change(c, t) : [c]))
      .sort((a, b) => a.start - b.start)
  }))
}

/** The track with one clip taken out and `pieces` punched in where it was. */
function replaceClip(project: Project, trackId: string, clipId: string, pieces: Clip[]): Project {
  return mapTrack(project, trackId, (t) => ({
    ...t,
    clips: pieces.reduce(
      insertClip,
      t.clips.filter((c) => c.id !== clipId)
    )
  }))
}

export function findClip(project: Project, trackId: string, clipId: string): Clip | undefined {
  return project.tracks.find((t) => t.id === trackId)?.clips.find((c) => c.id === clipId)
}

/** Slides a clip along its track. Whatever it lands on is punched out, as with recording. */
export function moveClip(
  project: Project,
  trackId: string,
  clipId: string,
  start: number
): Project {
  const clip = findClip(project, trackId, clipId)
  if (!clip) return project
  return replaceClip(project, trackId, clipId, [{ ...clip, start: Math.max(0, start) }])
}

/** Moves a clip's left edge, revealing or hiding audio while the rest stays in place. */
export function trimClipStart(
  project: Project,
  trackId: string,
  clipId: string,
  start: number
): Project {
  return mapClip(project, trackId, clipId, (c) => {
    const end = c.start + c.duration
    // Can't reveal audio from before the file begins, or cross the right edge.
    const earliest = Math.max(0, c.start - c.offset)
    const s = Math.min(Math.max(start, earliest), end - MIN_CLIP_SEC)
    const shift = s - c.start
    return [{ ...c, start: s, offset: c.offset + shift, duration: c.duration - shift }]
  })
}

/** Moves a clip's right edge, up to the end of its audio file. */
export function trimClipEnd(
  project: Project,
  trackId: string,
  clipId: string,
  end: number,
  fileDuration: number
): Project {
  return mapClip(project, trackId, clipId, (c) => {
    const latest = c.start + (fileDuration - c.offset)
    const e = Math.max(Math.min(end, latest), c.start + MIN_CLIP_SEC)
    return [{ ...c, duration: e - c.start }]
  })
}

/**
 * Slides a clip `bySec` earlier (later when negative) so it sits in time with the music.
 * Unlike a drag, a part that would land before the song starts is trimmed off, so the
 * rest keeps its timing.
 */
export function lineUpClip(
  project: Project,
  trackId: string,
  clipId: string,
  bySec: number
): Project {
  const clip = findClip(project, trackId, clipId)
  if (!clip) return project
  const start = clip.start - bySec
  if (start >= 0) return moveClip(project, trackId, clipId, start)
  return mapClip(project, trackId, clipId, (c) => [
    { ...c, start: 0, offset: c.offset - start, duration: Math.max(0, c.duration + start) }
  ])
}

/**
 * Brings a harmony in time with the lead phrase by phrase: cuts the clip halfway through
 * each pause and slides each piece `bySec` earlier (later when negative). `phrases` are
 * in seconds from the clip's start, in order. The pieces stay one group, so the take
 * still moves as one. Where two pieces would meet, the later one gives up the quiet at
 * its start; as with lining up, what would land before the song starts is trimmed off.
 */
export function syncPhrases(
  project: Project,
  trackId: string,
  clipId: string,
  phrases: { from: number; to: number; bySec: number }[]
): Project {
  const clip = findClip(project, trackId, clipId)
  if (!clip || phrases.length === 0) return project
  const group = phrases.length > 1 ? (clip.group ?? crypto.randomUUID()) : clip.group
  const cuts = phrases.slice(1).map((p, i) => (phrases[i].to + p.from) / 2)
  const edges = [0, ...cuts, clip.duration]
  const pieces: Clip[] = []
  let earliest = 0
  phrases.forEach((p, i) => {
    let from = edges[i]
    let start = clip.start + from - p.bySec
    if (start < earliest) {
      from += earliest - start
      start = earliest
    }
    const duration = edges[i + 1] - from
    if (duration < MIN_CLIP_SEC) return
    pieces.push({
      ...clip,
      id: i === 0 ? clip.id : crypto.randomUUID(),
      start,
      offset: clip.offset + from,
      duration,
      fadeIn: i === 0 ? clip.fadeIn : 0,
      fadeOut: i === phrases.length - 1 ? clip.fadeOut : 0,
      ...(group ? { group } : {})
    })
    earliest = start + duration
  })
  return replaceClip(project, trackId, clipId, pieces)
}

export function setClipFades(
  project: Project,
  trackId: string,
  clipId: string,
  fades: { fadeIn?: number; fadeOut?: number }
): Project {
  return mapClip(project, trackId, clipId, (c) => {
    const clamp = (v: number | undefined, fallback: number | undefined): number =>
      Math.max(0, Math.min(c.duration, v ?? fallback ?? 0))
    return [
      { ...c, fadeIn: clamp(fades.fadeIn, c.fadeIn), fadeOut: clamp(fades.fadeOut, c.fadeOut) }
    ]
  })
}

/** Cuts a clip in two at a timeline position. Fades stay on the outer ends. */
export function splitClip(project: Project, trackId: string, clipId: string, at: number): Project {
  return mapClip(project, trackId, clipId, (c) => {
    const into = at - c.start
    if (into < MIN_CLIP_SEC || c.duration - into < MIN_CLIP_SEC) return [c]
    return [
      { ...c, duration: into, fadeOut: 0 },
      {
        ...c,
        id: crypto.randomUUID(),
        start: at,
        offset: c.offset + into,
        duration: c.duration - into,
        fadeIn: 0
      }
    ]
  })
}

export function deleteClip(project: Project, trackId: string, clipId: string): Project {
  return mapClip(project, trackId, clipId, () => [])
}
