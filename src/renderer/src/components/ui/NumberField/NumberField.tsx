import { useEffect, useRef, useState } from 'react'
import { cx } from '../cx'
import { SCROLL_PER_STEP_PX } from './constants'
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
  /** Nudges the value one step up (1) or down (-1): scrolling over it, or the arrow keys. */
  onStep?(direction: 1 | -1): void
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
  className,
  onStep
}: Props): React.JSX.Element {
  const [draft, setDraft] = useState<string | null>(null)
  // Esc blurs the field too; this stops that blur applying what was typed.
  const cancelled = useRef(false)
  const field = useRef<HTMLSpanElement>(null)
  const step = useRef(onStep)
  useEffect(() => {
    step.current = onStep
  })
  const steps = !!onStep
  const scrolled = useRef(0)

  // Listened to directly: React's wheel listener is passive, so it can't stop the panel
  // underneath from scrolling too.
  useEffect(() => {
    const el = field.current
    if (!el || !steps || disabled) return
    const wheel = (e: WheelEvent): void => {
      e.preventDefault()
      scrolled.current += e.deltaY
      while (Math.abs(scrolled.current) >= SCROLL_PER_STEP_PX) {
        const up = scrolled.current < 0
        scrolled.current += up ? SCROLL_PER_STEP_PX : -SCROLL_PER_STEP_PX
        step.current?.(up ? 1 : -1)
      }
    }
    el.addEventListener('wheel', wheel, { passive: false })
    return () => el.removeEventListener('wheel', wheel)
  }, [steps, disabled])

  const commit = (): void => {
    if (!cancelled.current && draft !== null && draft !== value) onCommit(draft)
    cancelled.current = false
    setDraft(null)
  }

  return (
    <span ref={field} className={cx('number-field', `number-field-${align}`, className)}>
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
          if (onStep && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
            e.preventDefault()
            setDraft(null)
            onStep(e.key === 'ArrowUp' ? 1 : -1)
          }
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
