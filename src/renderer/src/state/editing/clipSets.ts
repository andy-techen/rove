// Working with several clips at once: selecting them, grouping them, and moving, deleting,
// copying or pasting them together. Grouped clips stay separate clips (their audio and
// windows are untouched); they only share a group id, so they're picked and moved as one.
import { Clip, Project, insertClip } from '../song/project'

export interface ClipRef {
  trackId: string
  clipId: string
}

const same = (a: ClipRef, b: ClipRef): boolean => a.trackId === b.trackId && a.clipId === b.clipId
const has = (refs: ClipRef[], ref: ClipRef): boolean => refs.some((r) => same(r, ref))

function clipsOf(project: Project, refs: ClipRef[]): (ClipRef & { clip: Clip })[] {
  return project.tracks.flatMap((t) =>
    t.clips
      .filter((c) => has(refs, { trackId: t.id, clipId: c.id }))
      .map((clip) => ({ trackId: t.id, clipId: clip.id, clip }))
  )
}

/** The clips plus every clip grouped with any of them; the given ones stay last, in order. */
export function withGroupmates(project: Project, refs: ClipRef[]): ClipRef[] {
  const groups = new Set(clipsOf(project, refs).flatMap(({ clip }) => clip.group ?? []))
  const mates = project.tracks.flatMap((t) =>
    t.clips
      .filter((c) => c.group !== undefined && groups.has(c.group))
      .map((c) => ({ trackId: t.id, clipId: c.id }))
      .filter((r) => !has(refs, r))
  )
  return [...mates, ...refs]
}

/** Whether any of the clips belongs to a group. */
export const anyGrouped = (project: Project, refs: ClipRef[]): boolean =>
  clipsOf(project, refs).some(({ clip }) => clip.group !== undefined)

function withClips(project: Project, change: (clip: Clip, ref: ClipRef) => Clip): Project {
  return {
    ...project,
    tracks: project.tracks.map((t) => ({
      ...t,
      clips: t.clips.map((c) => change(c, { trackId: t.id, clipId: c.id }))
    }))
  }
}

/** Links the clips into one group (two or more); any groups they were in are merged. */
export function groupClips(project: Project, refs: ClipRef[]): Project {
  const all = withGroupmates(project, refs)
  if (all.length < 2) return project
  const group = crypto.randomUUID()
  return withClips(project, (c, ref) => (has(all, ref) ? { ...c, group } : c))
}

/** Unlinks every group the clips belong to; the clips themselves stay as they are. */
export function ungroupClips(project: Project, refs: ClipRef[]): Project {
  const all = withGroupmates(project, refs)
  return withClips(project, (c, ref) => (has(all, ref) ? { ...c, group: undefined } : c))
}

/**
 * Slides the clips together by `deltaSec`, stopping where the earliest reaches the start
 * of the song. They're lifted off their tracks first, so they never punch each other out;
 * whatever else they land on is punched out, as with moving one clip.
 */
export function moveClips(project: Project, refs: ClipRef[], deltaSec: number): Project {
  const moving = clipsOf(project, refs)
  if (moving.length === 0) return project
  const earliest = Math.min(...moving.map(({ clip }) => clip.start))
  const delta = Math.max(deltaSec, -earliest)
  return {
    ...project,
    tracks: project.tracks.map((t) => {
      const mine = moving.filter((m) => m.trackId === t.id)
      if (mine.length === 0) return t
      const rest = t.clips.filter((c) => !mine.some((m) => m.clipId === c.id))
      return {
        ...t,
        clips: mine.reduce(
          (clips, { clip }) => insertClip(clips, { ...clip, start: clip.start + delta }),
          rest
        )
      }
    })
  }
}

export function deleteClips(project: Project, refs: ClipRef[]): Project {
  return {
    ...project,
    tracks: project.tracks.map((t) => ({
      ...t,
      clips: t.clips.filter((c) => !has(refs, { trackId: t.id, clipId: c.id }))
    }))
  }
}

/** Clips copied for pasting: where each sat relative to the earliest, and on which track. */
export interface CopiedClips {
  /** Each clip as copied; pasting gives it a new id and place. */
  items: { trackId: string; at: number; clip: Clip }[]
}

export function copyClips(project: Project, refs: ClipRef[]): CopiedClips | null {
  const copied = clipsOf(project, refs)
  if (copied.length === 0) return null
  const earliest = Math.min(...copied.map(({ clip }) => clip.start))
  return {
    items: copied.map(({ trackId, clip }) => ({ trackId, at: clip.start - earliest, clip }))
  }
}

/**
 * Pastes copied clips with the earliest at `at`, keeping their spacing. Clips copied from
 * one track go to `targetTrackId` when given (the caller checks it's the same kind);
 * clips from several tracks go back to their own tracks. Pasted groups get a new group
 * id, so the copy and the original move separately.
 */
export function pasteClips(
  project: Project,
  copied: CopiedClips,
  at: number,
  targetTrackId: string | null
): { project: Project; pasted: ClipRef[] } {
  const oneTrack = new Set(copied.items.map((i) => i.trackId)).size === 1
  const newGroup = new Map<string, string>()
  const pasted: ClipRef[] = []
  let next = project
  for (const item of copied.items) {
    const trackId = oneTrack && targetTrackId ? targetTrackId : item.trackId
    if (!next.tracks.some((t) => t.id === trackId)) continue
    const { group, ...rest } = item.clip
    if (group && !newGroup.has(group)) newGroup.set(group, crypto.randomUUID())
    const clip: Clip = {
      ...rest,
      ...(group ? { group: newGroup.get(group) } : {}),
      id: crypto.randomUUID(),
      start: Math.max(0, at + item.at)
    }
    next = {
      ...next,
      tracks: next.tracks.map((t) =>
        t.id === trackId ? { ...t, clips: insertClip(t.clips, clip) } : t
      )
    }
    pasted.push({ trackId, clipId: clip.id })
  }
  return { project: next, pasted }
}

/** The clips a box drawn across the timeline touches: lanes `trackIds`, `fromSec`–`toSec`. */
export function clipsInBox(
  tracks: { id: string; clips: { id: string; start: number; duration: number }[] }[],
  trackIds: string[],
  fromSec: number,
  toSec: number
): ClipRef[] {
  const [lo, hi] = fromSec <= toSec ? [fromSec, toSec] : [toSec, fromSec]
  return tracks
    .filter((t) => trackIds.includes(t.id))
    .flatMap((t) =>
      t.clips
        .filter((c) => c.start < hi && c.start + c.duration > lo)
        .map((c) => ({ trackId: t.id, clipId: c.id }))
    )
}

/** The selection after picking a clip: only it (with its group), or added to / taken out of it. */
export function pickClip(
  project: Project,
  current: ClipRef[],
  ref: ClipRef,
  mode: 'only' | 'toggle' | 'range'
): ClipRef[] {
  const picked = withGroupmates(project, [ref])
  if (mode === 'only') return picked
  if (has(current, ref)) return current.filter((r) => !has(picked, r))
  return [...current.filter((r) => !has(picked, r)), ...picked]
}

export { has as includesClip }
