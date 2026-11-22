import { ClipBlock } from '../../state/song/selectors'
import { SelectMode } from '../../state/editing/trackSelection'
import { cx } from '../ui/cx'
import type { Props as ClipProps } from './ClipView'
import { useClipPointer } from './useClipPointer'

interface Props {
  block: ClipBlock
  kind: 'backing' | 'vocal'
  pxPerSec: number
  scrollX: number
  selected: boolean
  editable: boolean
  /** Picks and drags the group through one of its clips. */
  onSelect(mode: SelectMode): void
  onGesture: ClipProps['onGesture']
}

/**
 * The single clip shape behind a run of grouped clips: it fills the gaps between them and
 * carries the selection outline, so the group reads (and drags) as one clip.
 */
export function ClipBlockView({
  block,
  kind,
  pxPerSec,
  scrollX,
  selected,
  editable,
  onSelect,
  onGesture
}: Props): React.JSX.Element {
  const { pointer, onClick } = useClipPointer(editable, pxPerSec, onSelect, onGesture)
  return (
    <div
      className={cx(
        'clip',
        'clip-block',
        `clip-${kind}`,
        selected && 'selected',
        editable && 'editable'
      )}
      // Runtime geometry: where the group sits in the visible part of the timeline.
      style={{
        left: block.start * pxPerSec - scrollX,
        width: (block.end - block.start) * pxPerSec
      }}
      onClick={onClick}
      data-clip-id={block.clipIds[0]}
      data-gesture="move"
      {...pointer}
    />
  )
}
