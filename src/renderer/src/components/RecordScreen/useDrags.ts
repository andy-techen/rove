import { useRef, useState } from 'react'
import { draggedBarStart, nudgedBarStart } from '../../state/chords/chart/chart'
import { ClipGestureKind, GestureStart, applyClipGesture } from '../../state/editing/clipGestures'
import {
  ClipRef,
  includesClip,
  laneShiftTo,
  moveClips,
  shiftLanes
} from '../../state/editing/clipSets'
import { SnapView, snapGesture } from '../../state/editing/snapping'
import { ProcessedAudio, bufferFor } from '../../state/processing/processedAudio'
import { findClip, musicOf, tempoOf, withSongStart } from '../../state/song/project'
import type { Song } from '../../state/song/useSong'
import type { BarDragSnap, GesturePhase } from '../Timeline'
import type { SongSelection } from './useSongSelection'

interface Options {
  song: Song
  canEdit: boolean
  selection: SongSelection
  processed: ProcessedAudio
  /** The music's beat, which bar 1 snaps to. */
  musicTempo: { bpm: number; startSec: number } | null
}

export interface Drags {
  /** Where a drag has snapped, shown as a guide line; null when it hasn't. */
  snapAt: number | null
  onClipGesture(
    ref: ClipRef,
    kind: ClipGestureKind,
    phase: GesturePhase,
    delta: number,
    snap: SnapView,
    overTrackId: string | null
  ): void
  /** Bar 1 dragged along the timeline. */
  onMoveBars(phase: GesturePhase, deltaSec: number, snap: BarDragSnap): void
  onNudgeBars(direction: -1 | 1): void
}

/** Dragging clips (moving, trimming, fading) and bar 1 on the timeline. */
export function useDrags({ song, canEdit, selection, processed, musicTempo }: Options): Drags {
  const open = song.song
  const [snapAt, setSnapAt] = useState<number | null>(null)
  const gesture = useRef<
    (GestureStart & { key: string; together: ClipRef[]; laneShift: number }) | null
  >(null)
  const gestureCount = useRef(0)
  // Bar 1 being dragged: where it started, and the undo step every move joins.
  const barsDrag = useRef<{ fromSec: number; key: string } | null>(null)

  const startClipDrag = (ref: ClipRef, kind: ClipGestureKind): void => {
    if (!open) return
    const clip = findClip(open.data, ref.trackId, ref.clipId)
    if (!clip) return
    const { selectedClips } = selection
    // Dragging one of several selected clips moves them all.
    const together =
      kind !== 'move'
        ? []
        : selectedClips.length > 1 && includesClip(selectedClips, ref)
          ? selectedClips
          : [ref]
    gesture.current = {
      together,
      moving: together.flatMap((r) => findClip(open.data, r.trackId, r.clipId) ?? []),
      laneShift: 0,
      base: open.data,
      trackId: ref.trackId,
      clip,
      fileSec:
        bufferFor(song.audio, processed, ref.trackId, clip.file)?.duration ??
        clip.offset + clip.duration,
      // Each drag is its own undo step, however many moves it takes.
      key: `clip-drag:${++gestureCount.current}`
    }
  }

  return {
    snapAt,
    onClipGesture: (ref, kind, phase, delta, snap, overTrackId) => {
      if (!open) return
      if (phase === 'start') return startClipDrag(ref, kind)
      const g = gesture.current
      if (!g) return
      const snapped = snapGesture(g, kind, delta, snap)
      if (!g.together.length) {
        song.edit(applyClipGesture(g, kind, snapped.deltaSec), g.key)
      } else {
        // The timeline shows the clips lifted into the lane they'd drop into;
        // they move there when the drag ends.
        const shift = laneShiftTo(g.base, g.trackId, overTrackId)
        if (shift !== null && shiftLanes(g.base, g.together, shift)) g.laneShift = shift
        const lanes = phase === 'end' ? g.laneShift : 0
        song.edit(moveClips(g.base, g.together, snapped.deltaSec, lanes), g.key)
        if (phase === 'end') selection.setClips(shiftLanes(g.base, g.together, lanes) ?? g.together)
      }
      setSnapAt(phase === 'end' ? null : snapped.at)
      if (phase === 'end') gesture.current = null
    },
    onMoveBars: (phase, deltaSec, { toleranceSec, playheadSec }) => {
      if (!open) return
      if (phase === 'start')
        barsDrag.current = {
          fromSec: tempoOf(open.data).startSec,
          key: `bars-drag:${++gestureCount.current}`
        }
      const drag = barsDrag.current
      if (!drag) return
      const { speed } = musicOf(open.data)
      const clipEdges = open.data.tracks.flatMap((t) =>
        t.clips.flatMap((c) => [c.start, c.start + c.duration])
      )
      const moved = draggedBarStart(
        drag.fromSec,
        deltaSec,
        speed,
        { beat: musicTempo, clipEdges, playheadSec },
        toleranceSec
      )
      song.edit(withSongStart(open.data, moved.startSec), drag.key)
      setSnapAt(phase === 'end' ? null : moved.snappedAt)
      if (phase === 'end') barsDrag.current = null
    },
    onNudgeBars: (direction) => {
      if (!open || !canEdit) return
      const { startSec } = tempoOf(open.data)
      const next = nudgedBarStart(startSec, direction, musicOf(open.data).speed)
      song.edit(withSongStart(open.data, next), 'bars-nudge')
    }
  }
}
