import { cx } from '../cx'
import './Segmented.css'

export interface SegmentedOption<T> {
  value: T
  label: string
}

interface Props<T> {
  /** Accessible name of the group. */
  label: string
  options: readonly SegmentedOption<T>[]
  value: T
  // Inferred from the options and value: a state setter takes more than T.
  onChange(value: NoInfer<T>): void
  disabled?: boolean
  /** Layout from the caller (how wide the group sits). */
  className?: string
}

/** A few choices side by side, one of them on: a group of pressed-or-not buttons. */
export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
  disabled,
  className
}: Props<T>): React.JSX.Element {
  return (
    <div className={cx('segmented', className)} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="segmented-option"
          aria-pressed={option.value === value}
          disabled={disabled}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
