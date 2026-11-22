// Working with several clips at once: selecting them, grouping them, and moving, deleting,
// copying or pasting them together. Grouped clips stay separate clips (their audio and
// windows are untouched); they only share a group id, so they're picked and moved as one.
import { Clip, MIN_CLIP_SEC, Project, TrackRole, insertClip, splitClip } from '../song/project'

/** The tracks in order with their kinds: a project, or the lanes the timeline shows. */
type Lanes = { tracks: { id: string; role: TrackRole }[] }

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

/** Whether the clips are exactly one whole group already, so grouping would change nothing. */
export function isOneGroup(project: Project, refs: ClipRef[]): boolean {
  const groups = new Set(clipsOf(project, refs).map(({ clip }) => clip.group))
  const [group] = groups
  return (
    groups.size === 1 && group !== undefined && withGroupmates(project, refs).length === refs.length
  )
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

/** How many lanes apart two tracks of the same kind are; null for another kind or none. */
export function laneShiftTo(
  project: Lanes,
  fromTrackId: string,
  toTrackId: string | null
): number | null {
  const from = project.tracks.find((t) => t.id === fromTrackId)
  const to = project.tracks.find((t) => t.id === toTrackId)
  if (!from || !to || from.role !== to.role) return null
  const kin = project.tracks.filter((t) => t.role === from.role)
  return kin.indexOf(to) - kin.indexOf(from)
}

/**
 * Where each clip lands when dragged `shift` lanes down (up when negative), staying among
 * tracks of its own kind; null when any would go past the last of them.
 */
export function shiftLanes(project: Lanes, refs: ClipRef[], shift: number): ClipRef[] | null {
  if (shift === 0) return refs
  const shifted: ClipRef[] = []
  for (const ref of refs) {
    const track = project.tracks.find((t) => t.id === ref.trackId)
    const kin = project.tracks.filter((t) => t.role === track?.role)
    const target = track && kin[kin.indexOf(track) + shift]
    if (!target) return null
    shifted.push({ trackId: target.id, clipId: ref.clipId })
  }
  return shifted
}

/** The shift nearest `wanted` (towards no shift) that keeps every clip on a track of its kind. */
export function fittingShift(project: Lanes, refs: ClipRef[], wanted: number): number {
  let shift = wanted
  while (shift !== 0 && !shiftLanes(project, refs, shift)) shift -= Math.sign(shift)
  return shift
}

/**
 * Slides the clips together by `deltaSec`, and `laneShift` lanes down or up, stopping
 * where the earliest reaches the start of the song. Clips only change lanes when all of
 * them can. They're lifted off their tracks first, so they never punch each other out;
 * whatever else they land on is punched out, as with moving one clip.
 */
export function moveClips(
  project: Project,
  refs: ClipRef[],
  deltaSec: number,
  laneShift = 0
): Project {
  const moving = clipsOf(project, refs)
  if (moving.length === 0) return project
  const to = shiftLanes(project, moving, laneShift) ?? moving
  const earliest = Math.min(...moving.map(({ clip }) => clip.start))
  const delta = Math.max(deltaSec, -earliest)
  const touched = new Set([...moving, ...to].map((r) => r.trackId))
  return {
    ...project,
    tracks: project.tracks.map((t) => {
      if (!touched.has(t.id)) return t
      const rest = t.clips.filter(
        (c) => !moving.some((m) => m.trackId === t.id && m.clipId === c.id)
      )
      return {
        ...t,
        clips: moving.reduce(
          (clips, { clip }, i) =>
            to[i].trackId === t.id
              ? insertClip(clips, { ...clip, start: clip.start + delta })
              : clips,
          rest
        )
      }
    })
  }
}

const cuts = (clip: Clip, at: number): boolean =>
  at - clip.start >= MIN_CLIP_SEC && clip.start + clip.duration - at >= MIN_CLIP_SEC

/**
 * Whether Split would change anything: a selected clip runs across the playhead, or a
 * selected group has clips on both sides of it.
 */
export function canSplitClips(project: Project, refs: ClipRef[], at: number): boolean {
  const picked = clipsOf(project, withGroupmates(project, refs))
  if (picked.some(({ clip }) => cuts(clip, at))) return true
  const before = new Set(picked.filter(({ clip }) => clip.start < at).map(({ clip }) => clip.group))
  return picked.some(({ clip }) => clip.start >= at && clip.group && before.has(clip.group))
}

/**
 * Splits the selected clips at the playhead. A group is one clip to the singer, so it
 * splits too: what's before the playhead and what's after become two groups (a side left
 * with one clip is just that clip).
 */
export function splitClips(project: Project, refs: ClipRef[], at: number): Project {
  const picked = clipsOf(project, withGroupmates(project, refs))
  let next = picked.reduce(
    (p, { trackId, clipId, clip }) => (cuts(clip, at) ? splitClip(p, trackId, clipId, at) : p),
    project
  )
  const groups = new Set(picked.flatMap(({ clip }) => clip.group ?? []))
  for (const group of groups) {
    const sides = { before: crypto.randomUUID(), after: crypto.randomUUID() }
    const members = next.tracks.flatMap((t) => t.clips.filter((c) => c.group === group))
    const count = (after: boolean): number => members.filter((c) => c.start >= at === after).length
    const sizes = { before: count(false), after: count(true) }
    next = withClips(next, (c) => {
      if (c.group !== group) return c
      const side = c.start >= at ? 'after' : 'before'
      return { ...c, group: sizes[side] > 1 ? sides[side] : undefined }
    })
  }
  return next
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
