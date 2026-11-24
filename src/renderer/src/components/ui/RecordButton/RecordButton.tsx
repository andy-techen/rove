import { IconButton } from '../IconButton'
import { cx } from '../cx'
import './RecordButton.css'

interface Props {
  recording: boolean
  /** Accessible name and tooltip, which change with `recording`. */
  label: string
  /** A tooltip other than the label: why it's disabled, or what stopping does. */
  title?: string
  disabled?: boolean
  onClick(): void
}

/**
 * Record on a track: a red dot in a round button, which fills red and shows stop while
 * recording. Toolbars use a square `IconButton` with `recordRing` instead, to match.
 */
export function RecordButton({
  recording,
  label,
  title,
  disabled,
  onClick
}: Props): React.JSX.Element {
  return (
    <IconButton
      icon={recording ? 'stop' : 'record'}
      iconSize="secondary"
      className={cx('record-button', recording && 'recording')}
      label={label}
      title={title}
      aria-pressed={recording}
      disabled={disabled}
      onClick={onClick}
    />
  )
}
