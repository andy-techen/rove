import { useRef } from 'react'
import { ClipGestureKind } from '../../state/editing/clipGestures'
import { SelectMode, selectMode } from '../../state/editing/trackSelection'
import type { Props as ClipProps } from './ClipView'
import { DRAG_THRESHOLD_PX } from './constants'

/**
 * Pointer handling for anything that drags a clip: the clip body and its handles, or the
 * block behind grouped clips. Each element names its gesture in `data-gesture`.
 */
export function useClipPointer(
  editable: boolean,
  pxPerSec: number,
  onSelect: (mode: SelectMode) => void,
  onGesture: ClipProps['onGesture']
): {
  pointer: React.HTMLAttributes<HTMLDivElement>
  onClick: (e: React.MouseEvent) => void
} {
  const drag = useRef<{ kind: ClipGestureKind; x0: number; y0: number; moved: boolean } | null>(
    null
  )
  // A drag ends with a click event; this stops that click from also moving the playhead.
  const suppressClick = useRef(false)
  const pointer: React.HTMLAttributes<HTMLDivElement> = {
    onPointerDown: (e) => {
      if (!editable || e.button !== 0) return
      e.stopPropagation()
      e.currentTarget.setPointerCapture(e.pointerId)
      const kind = e.currentTarget.dataset.gesture as ClipGestureKind
      drag.current = { kind, x0: e.clientX, y0: e.clientY, moved: false }
      onSelect(selectMode(e))
    },
    onPointerMove: (e) => {
      const d = drag.current
      if (!d || d.kind !== e.currentTarget.dataset.gesture) return
      const dx = e.clientX - d.x0
      if (!d.moved) {
        // Up or down counts too: a clip can be dragged straight into another lane.
        if (Math.hypot(dx, e.clientY - d.y0) < DRAG_THRESHOLD_PX) return
        d.moved = true
        onGesture(d.kind, 'start', 0, e.altKey, e.clientY)
      }
      onGesture(d.kind, 'move', dx / pxPerSec, e.altKey, e.clientY)
    },
    onPointerUp: (e) => {
      const d = drag.current
      if (!d || d.kind !== e.currentTarget.dataset.gesture) return
      drag.current = null
      if (d.moved) {
        suppressClick.current = true
        onGesture(d.kind, 'end', (e.clientX - d.x0) / pxPerSec, e.altKey, e.clientY)
      }
    },
    onPointerCancel: () => {
      const d = drag.current
      drag.current = null
      // Cancelled: back where it started, in its own lane.
      if (d?.moved) onGesture(d.kind, 'end', 0, true, d.y0)
    }
  }

  const onClick = (e: React.MouseEvent): void => {
    if (suppressClick.current) {
      suppressClick.current = false
      e.stopPropagation()
    }
  }
  return { pointer, onClick }
}
