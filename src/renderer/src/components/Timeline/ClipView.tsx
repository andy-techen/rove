import { useRef } from 'react'
import { t } from '@shared/copy'
import { ClipGestureKind } from '../../state/editing/clipGestures'
import { ClipShape } from '../../state/song/selectors'
import { cx } from '../ui/cx'
import { Tooltip } from '../ui/Tooltip'
import { Waveform } from './Waveform'

export type GesturePhase = 'start' | 'move' | 'end'

interface Props {
  clip: ClipShape
  kind: 'backing' | 'vocal'
  pxPerSec: number
  /** How far the timeline is scrolled, in px. */
  scrollX: number
  /** Width of the visible timeline, in px. */
  viewWidth: number
  height: number
  selected: boolean
  editable: boolean
  onSelect(): void
  /** `deltaSec` is measured from where the drag began; `free` while ⌥ holds off snapping. */
  onGesture(kind: ClipGestureKind, phase: GesturePhase, deltaSec: number, free: boolean): void
}

// Movement below this many pixels is a click, not a drag.
const DRAG_THRESHOLD_PX = 3

export function ClipView({
  clip,
  kind,
  pxPerSec,
  scrollX,
  viewWidth,
  height,
  selected,
  editable,
  onSelect,
  onGesture
}: Props): React.JSX.Element {
  const drag = useRef<{ kind: ClipGestureKind; x0: number; moved: boolean } | null>(null)
  // A drag ends with a click event; this stops that click from also moving the playhead.
  const suppressClick = useRef(false)
  const width = clip.duration * pxPerSec
  const left = clip.start * pxPerSec - scrollX
  // The on-screen slice of the clip, in px from its left edge.
  const visibleFrom = Math.max(0, -left)
  const visibleTo = Math.min(width, viewWidth - left)
  const fadeInPx = clip.fadeIn * pxPerSec
  const fadeOutPx = clip.fadeOut * pxPerSec

  // One set of handlers serves the clip body and every handle; each element says
  // which gesture it starts through its data-gesture attribute.
  const pointer: React.HTMLAttributes<HTMLDivElement> = {
    onPointerDown: (e) => {
      if (!editable || e.button !== 0) return
      e.stopPropagation()
      e.currentTarget.setPointerCapture(e.pointerId)
      const kind = e.currentTarget.dataset.gesture as ClipGestureKind
      drag.current = { kind, x0: e.clientX, moved: false }
      onSelect()
    },
    onPointerMove: (e) => {
      const d = drag.current
      if (!d || d.kind !== e.currentTarget.dataset.gesture) return
      const dx = e.clientX - d.x0
      if (!d.moved) {
        if (Math.abs(dx) < DRAG_THRESHOLD_PX) return
        d.moved = true
        onGesture(d.kind, 'start', 0, e.altKey)
      }
      onGesture(d.kind, 'move', dx / pxPerSec, e.altKey)
    },
    onPointerUp: (e) => {
      const d = drag.current
      if (!d || d.kind !== e.currentTarget.dataset.gesture) return
      drag.current = null
      if (d.moved) {
        suppressClick.current = true
        onGesture(d.kind, 'end', (e.clientX - d.x0) / pxPerSec, e.altKey)
      }
    },
    onPointerCancel: () => {
      const d = drag.current
      drag.current = null
      if (d?.moved) onGesture(d.kind, 'end', 0, true)
    }
  }

  return (
    <div
      className={cx('clip', `clip-${kind}`, selected && 'selected', editable && 'editable')}
      // Runtime geometry: where the clip sits in the visible part of the timeline.
      style={{ left, width }}
      onClick={(e) => {
        if (suppressClick.current) {
          suppressClick.current = false
          e.stopPropagation()
        }
      }}
      data-gesture="move"
      {...pointer}
    >
      {clip.audio && visibleTo > visibleFrom && (
        <Waveform
          audio={clip.audio}
          offset={clip.offset + visibleFrom / pxPerSec}
          pxPerSec={pxPerSec}
          left={visibleFrom}
          width={visibleTo - visibleFrom}
          height={height}
        />
      )}
      {(fadeInPx > 0 || fadeOutPx > 0) && width > 0 && (
        <svg className="fade-overlay" width={width} height={height} aria-hidden="true">
          {fadeInPx > 0 && <polygon points={`0,0 ${fadeInPx},0 0,${height}`} />}
          {fadeInPx > 0 && <line x1={0} y1={height} x2={fadeInPx} y2={0} />}
          {fadeOutPx > 0 && (
            <polygon points={`${width},0 ${width - fadeOutPx},0 ${width},${height}`} />
          )}
          {fadeOutPx > 0 && <line x1={width - fadeOutPx} y1={0} x2={width} y2={height} />}
        </svg>
      )}
      {editable && (
        <>
          <Tooltip text={t('clip.trim')}>
            <div className="clip-trim left" data-gesture="trimStart" {...pointer} />
          </Tooltip>
          <Tooltip text={t('clip.trim')}>
            <div className="clip-trim right" data-gesture="trimEnd" {...pointer} />
          </Tooltip>
          <Tooltip text={t('clip.fadeIn')}>
            <div
              className="fade-handle"
              style={{ left: fadeInPx }}
              data-gesture="fadeIn"
              {...pointer}
            />
          </Tooltip>
          <Tooltip text={t('clip.fadeOut')}>
            <div
              className="fade-handle"
              style={{ left: width - fadeOutPx }}
              data-gesture="fadeOut"
              {...pointer}
            />
          </Tooltip>
        </>
      )}
    </div>
  )
}
