import { CSSProperties, KeyboardEvent, PointerEvent } from 'react'
import { t } from '@shared/copy'
import { Tooltip } from '../ui/Tooltip'

export type Side = 'left' | 'right'
const SIDES: Side[] = ['left', 'right']

interface Props {
  /** The box's placement on the frame; a grip sits at the middle of each side. */
  placement: CSSProperties
  label(side: Side): string
  onDown(e: PointerEvent<HTMLDivElement>, side: Side): void
  onMove(e: PointerEvent<HTMLDivElement>): void
  onUp(): void
  onKey(e: KeyboardEvent, side: Side): void
  /** Double-click: back to fitting the lines. */
  onFit(): void
}

/** A grip on each side of the chosen text: drag one to set how wide the lines run. */
export function EdgeHandles({
  placement,
  label,
  onDown,
  onMove,
  onUp,
  onKey,
  onFit
}: Props): React.JSX.Element {
  return (
    <>
      {SIDES.map((side) => (
        <Tooltip key={side} text={t('export.video.edgeTip')}>
          <div
            className="picture-edge"
            data-side={side}
            role="separator"
            aria-orientation="vertical"
            aria-label={label(side)}
            tabIndex={0}
            style={placement}
            onPointerDown={(e) => onDown(e, side)}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onDoubleClick={onFit}
            onKeyDown={(e) => onKey(e, side)}
          />
        </Tooltip>
      ))}
    </>
  )
}
