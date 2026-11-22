import { useRef } from 'react'
import { cx } from '../cx'
import './Splitter.css'

interface Props {
  /** Accessible name: what it resizes. */
  label: string
  /** 'vertical' sits between side-by-side areas and drags sideways; 'horizontal' drags up and down. */
  orientation: 'vertical' | 'horizontal'
  value: number
  min: number
  max: number
  /** How much the value changes per pixel dragged right (or down); negative to grow the other way. */
  perPixel: number
  onChange(value: number): void
  className?: string
}

// Arrow keys move the edge by this many pixels; with Shift, much further.
const KEY_STEP_PX = 16
const SHIFT_STEPS = 4

/** A draggable edge between two areas. Also moves with the arrow keys once focused. */
export function Splitter({
  label,
  orientation,
  value,
  min,
  max,
  perPixel,
  onChange,
  className
}: Props): React.JSX.Element {
  const drag = useRef<{ from: number; start: number } | null>(null)
  const clamp = (v: number): number => Math.round(Math.max(min, Math.min(max, v)))
  const along = (e: { clientX: number; clientY: number }): number =>
    orientation === 'vertical' ? e.clientX : e.clientY
  const [back, forward] =
    orientation === 'vertical' ? ['ArrowLeft', 'ArrowRight'] : ['ArrowUp', 'ArrowDown']

  return (
    <div
      role="separator"
      aria-label={label}
      aria-orientation={orientation}
      aria-valuenow={Math.round(value)}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      className={cx('splitter', `splitter-${orientation}`, className)}
      onPointerDown={(e) => {
        if (e.button !== 0) return
        e.preventDefault()
        e.currentTarget.setPointerCapture?.(e.pointerId)
        drag.current = { from: along(e), start: value }
      }}
      onPointerMove={(e) => {
        const d = drag.current
        if (d) onChange(clamp(d.start + (along(e) - d.from) * perPixel))
      }}
      onPointerUp={() => {
        drag.current = null
      }}
      onPointerCancel={() => {
        drag.current = null
      }}
      onKeyDown={(e) => {
        const steps = e.shiftKey ? SHIFT_STEPS : 1
        if (e.key === back) onChange(clamp(value - KEY_STEP_PX * steps * perPixel))
        else if (e.key === forward) onChange(clamp(value + KEY_STEP_PX * steps * perPixel))
        else return
        e.preventDefault()
        e.stopPropagation()
      }}
    />
  )
}
