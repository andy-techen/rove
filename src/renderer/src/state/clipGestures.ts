import { Clip, Project, moveClip, setClipFades, trimClipEnd, trimClipStart } from './project'

export type ClipGestureKind = 'move' | 'trimStart' | 'trimEnd' | 'fadeIn' | 'fadeOut'

export interface GestureStart {
  /** The project as it was when the drag began; every move is applied to this. */
  base: Project
  trackId: string
  clip: Clip
  /** Length of the clip's audio file, the limit for trimming its end. */
  fileSec: number
}

/**
 * The project after dragging part of a clip `deltaSec` from where the drag began.
 * Recomputing from the starting project each time means neighbours punched out by a
 * move reappear when the clip moves away again.
 */
export function applyClipGesture(
  start: GestureStart,
  kind: ClipGestureKind,
  deltaSec: number
): Project {
  const { base, trackId, clip, fileSec } = start
  switch (kind) {
    case 'move':
      return moveClip(base, trackId, clip.id, clip.start + deltaSec)
    case 'trimStart':
      return trimClipStart(base, trackId, clip.id, clip.start + deltaSec)
    case 'trimEnd':
      return trimClipEnd(base, trackId, clip.id, clip.start + clip.duration + deltaSec, fileSec)
    case 'fadeIn':
      return setClipFades(base, trackId, clip.id, { fadeIn: (clip.fadeIn ?? 0) + deltaSec })
    case 'fadeOut':
      return setClipFades(base, trackId, clip.id, { fadeOut: (clip.fadeOut ?? 0) - deltaSec })
  }
}
