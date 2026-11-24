import { cx } from '../cx'
import { Icon } from '../Icon'
import './Select.css'

export interface SelectOption {
  value: string
  label: string
}

interface Props {
  /** Accessible name and tooltip. */
  label: string
  value: string
  options: SelectOption[]
  disabled?: boolean
  onChange(value: string): void
  className?: string
}

/** A native drop-down (keyboard and screen readers work as usual), styled to match. */
export function Select({
  label,
  value,
  options,
  disabled,
  onChange,
  className
}: Props): React.JSX.Element {
  return (
    <span className={cx('select', className)}>
      <select
        aria-label={label}
        title={label}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Icon name="chevronDown" size="secondary" />
    </span>
  )
}
