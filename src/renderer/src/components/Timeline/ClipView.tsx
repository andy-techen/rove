import { CSSProperties } from 'react'
import { t } from '@shared/copy'
import { ClipGestureKind } from '../../state/editing/clipGestures'
import { ClipShape } from '../../state/song/selectors'
import { SelectMode } from '../../state/editing/trackSelection'
import { useClipPointer } from './useClipPointer'
import { cx } from '../ui/cx'
import { Tooltip } from '../ui/Tooltip'
import { Waveform } from './Waveform'

export type GesturePhase = 'start' | 'move' | 'end'

export interface Props {
  clip: ClipShape
  kind: 'backing' | 'vocal'
  pxPerSec: number
  /** How far the timeline is scrolled, in px. */
  scrollX: number
  /** Width of the visible timeline, in px. */
  viewWidth: number
  height: number
  selected: boolean
  /** Dragged this far up or down (px) towards another lane; null when not lifted. */
  liftY: number | null
  editable: boolean
  /** Pressed: on its own, or ⌘/⇧ to add it to the selection. */
  onSelect(mode: SelectMode): void
  /**
   * `deltaSec` is measured from where the drag began; `free` while ⌥ holds off snapping;
   * `clientY` is the pointer's height, for moving into another lane.
   */
  onGesture(
    kind: ClipGestureKind,
    phase: GesturePhase,
    deltaSec: number,
    free: boolean,
    clientY: number
  ): void
}

export function ClipView({
  clip,
  kind,
  pxPerSec,
  scrollX,
  viewWidth,
  height,
  selected,
  liftY,
  editable,
  onSelect,
  onGesture
}: Props): React.JSX.Element {
  const { pointer, onClick } = useClipPointer(editable, pxPerSec, onSelect, onGesture)
  const width = clip.duration * pxPerSec
  const left = clip.start * pxPerSec - scrollX
  // The on-screen slice of the clip, in px from its left edge.
  const visibleFrom = Math.max(0, -left)
  const visibleTo = Math.min(width, viewWidth - left)
  const fadeInPx = clip.fadeIn * pxPerSec
  const fadeOutPx = clip.fadeOut * pxPerSec

  return (
    <div
      className={cx(
        'clip',
        `clip-${kind}`,
        selected && 'selected',
        liftY !== null && 'lifted',
        editable && 'editable',
        clip.joinedBefore && 'joined-before',
        clip.joinedAfter && 'joined-after'
      )}
      // Runtime geometry: where the clip sits in the visible part of the timeline.
      style={{ left, width, '--lift-y': `${liftY ?? 0}px` } as CSSProperties}
      onClick={onClick}
      data-clip-id={clip.id}
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
          {!clip.joinedBefore && (
            <Tooltip text={t('clip.trim')}>
              <div className="clip-trim left" data-gesture="trimStart" {...pointer} />
            </Tooltip>
          )}
          {!clip.joinedAfter && (
            <Tooltip text={t('clip.trim')}>
              <div className="clip-trim right" data-gesture="trimEnd" {...pointer} />
            </Tooltip>
          )}
          {!clip.joinedBefore && (
            <Tooltip text={t('clip.fadeIn')}>
              <div
                className="fade-handle"
                style={{ left: fadeInPx }}
                data-gesture="fadeIn"
                {...pointer}
              />
            </Tooltip>
          )}
          {!clip.joinedAfter && (
            <Tooltip text={t('clip.fadeOut')}>
              <div
                className="fade-handle"
                style={{ left: width - fadeOutPx }}
                data-gesture="fadeOut"
                {...pointer}
              />
            </Tooltip>
          )}
        </>
      )}
    </div>
  )
}
