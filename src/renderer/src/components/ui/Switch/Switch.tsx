import { Tooltip } from '../Tooltip'
import './Switch.css'

interface Props {
  checked: boolean
  onChange(checked: boolean): void
  /** Accessible name. Shown next to the toggle unless `hideLabel` is set. */
  label: string
  hideLabel?: boolean
  title?: string
  disabled?: boolean
}

/** An on/off toggle. Built on a checkbox, so it works with the keyboard and screen readers. */
export function Switch({
  checked,
  onChange,
  label,
  hideLabel,
  title,
  disabled
}: Props): React.JSX.Element {
  const toggle = (
    <label className="switch">
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className={hideLabel ? 'visually-hidden' : 'switch-label'}>{label}</span>
    </label>
  )
  return title ? <Tooltip text={title}>{toggle}</Tooltip> : toggle
}
