import { ClipGestureKind, GestureStart } from './clipGestures'

/** What a drag can snap to, from the timeline as it's shown. */
export interface SnapView {
  /** How close counts as "at" a target: a few pixels, in seconds at the current zoom. */
  toleranceSec: number
  /** Spacing of the ruler's small ticks. */
  gridSec: number
  playheadSec: number
  /** Snapping is held off (⌥ while dragging). */
  free: boolean
}

export interface Snapped {
  deltaSec: number
  /** Where the clip snapped, for a guide line; null when it didn't. */
  at: number | null
}

// Rounds away float dust so a snapped time compares equal to the target.
const PRECISION = 1e6
const tidy = (sec: number): number => Math.round(sec * PRECISION) / PRECISION

/** The song start, the playhead, and every edge of every other clip, on any track. */
function edgesBesides(start: GestureStart, playheadSec: number): number[] {
  const edges = start.base.tracks.flatMap((track) =>
    track.clips
      .filter((c) => c.id !== start.clip.id)
      .flatMap((c) => [c.start, c.start + c.duration])
  )
  return [0, playheadSec, ...edges]
}

/** The edges of the dragged clip that move with this gesture, where they began. */
function movingEdges(start: GestureStart, kind: ClipGestureKind): number[] {
  const { clip } = start
  const end = clip.start + clip.duration
  if (kind === 'move') return [clip.start, end]
  if (kind === 'trimStart') return [clip.start]
  if (kind === 'trimEnd') return [end]
  return []
}

/** The nearest target to any moving edge, within tolerance. */
function nearest(
  edges: number[],
  deltaSec: number,
  targets: (pos: number) => number[],
  toleranceSec: number
): Snapped | null {
  let best: Snapped | null = null
  let bestDistance = toleranceSec
  for (const edge of edges) {
    const pos = edge + deltaSec
    for (const target of targets(pos)) {
      const distance = Math.abs(target - pos)
      if (distance <= bestDistance) {
        bestDistance = distance
        best = { deltaSec: tidy(target - edge), at: tidy(target) }
      }
    }
  }
  return best
}

/**
 * Pulls a drag onto something worth lining up with: another clip's edge (on any
 * track), the playhead or the song start first, else the nearest small tick on the
 * ruler. Fades don't snap; their length is a matter of taste, not alignment.
 */
export function snapGesture(
  start: GestureStart,
  kind: ClipGestureKind,
  deltaSec: number,
  view: SnapView
): Snapped {
  const edges = movingEdges(start, kind)
  if (view.free || !edges.length) return { deltaSec, at: null }
  const others = edgesBesides(start, view.playheadSec)
  const toTick = (pos: number): number[] =>
    view.gridSec > 0 ? [Math.round(pos / view.gridSec) * view.gridSec] : []
  return (
    nearest(edges, deltaSec, () => others, view.toleranceSec) ??
    nearest(edges, deltaSec, toTick, view.toleranceSec) ?? { deltaSec, at: null }
  )
}
