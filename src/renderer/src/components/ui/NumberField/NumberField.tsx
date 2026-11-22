import { useRef, useState } from 'react'
import { cx } from '../cx'
import './NumberField.css'

interface Props {
  /** Accessible name for the field. */
  label: string
  /** The current value as shown when not editing. */
  value: string
  unit?: string
  disabled?: boolean
  /** Called with what was typed when it's applied; the owner parses and clamps it. */
  onCommit(text: string): void
  /** Right-aligned by default, to line up in a column; start-aligned beside a label. */
  align?: 'start' | 'end'
  className?: string
}

/**
 * A compact number to type over: Enter or leaving the field applies it, Esc puts the
 * shown value back. Pairs with a slider when an exact value matters.
 */
export function NumberField({
  label,
  value,
  unit,
  disabled,
  onCommit,
  align = 'end',
  className
}: Props): React.JSX.Element {
  const [draft, setDraft] = useState<string | null>(null)
  // Esc blurs the field too; this stops that blur applying what was typed.
  const cancelled = useRef(false)

  const commit = (): void => {
    if (!cancelled.current && draft !== null && draft !== value) onCommit(draft)
    cancelled.current = false
    setDraft(null)
  }

  return (
    <span className={cx('number-field', `number-field-${align}`, className)}>
      <input
        type="text"
        inputMode="decimal"
        aria-label={label}
        value={draft ?? value}
        disabled={disabled}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') {
            cancelled.current = true
            e.currentTarget.blur()
          }
        }}
      />
      {unit && <span className="number-field-unit">{unit}</span>}
    </span>
  )
}
