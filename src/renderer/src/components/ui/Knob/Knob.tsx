import { useRef } from 'react'
import { cx } from '../cx'
import { Tooltip } from '../Tooltip'
import { CENTRE, DETENT, FACE, MARKER_R, POINTER, RING, VIEW } from './constants'
import { arcPath, dragTravel, dragValue, fractionOf, pointAt } from './knobMath'
import './Knob.css'

export interface KnobProps {
  value: number
  min: number
  max: number
  step?: number
  onChange(value: number): void
  /** Accessible name. */
  label: string
  /** Spoken value, e.g. "+2 semitones". */
  valueText?: string
  /** Tooltip. */
  title?: string
  /**
   * For knobs that turn both ways (position, key, speed): the value that means
   * "unchanged". The coloured arc grows from it, and the knob clicks onto it.
   */
  centre?: number
  /**
   * Where double-click returns, shown as a green dot on the ring: a suggested value.
   * A centred knob marks its centre this way unless given another.
   */
  marker?: number
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  className?: string
}

/**
 * A knob: drag up or right to turn it up (down or left, down), arrow keys step it,
 * double-click puts it back (on its centre, else its suggested value). A hidden native
 * range input carries keyboard use and the accessible name, so it reads as a slider.
 */
export function Knob({
  value,
  min,
  max,
  step = 1,
  onChange,
  label,
  valueText,
  title,
  centre,
  marker,
  size = 'sm',
  disabled,
  className
}: KnobProps): React.JSX.Element {
  const drag = useRef<{ x: number; y: number; from: number } | null>(null)
  const range = { min, max, step, centre }
  const f = fractionOf(value, range)
  const atCentre = centre !== undefined && Math.abs(value - centre) <= (DETENT * (max - min)) / 2
  const tip = pointAt(f, POINTER)
  const centreAt = centre === undefined ? null : fractionOf(centre, range)
  const home = marker ?? centre
  const markAt = home === undefined ? null : pointAt(fractionOf(home, range), RING)

  const knob = (
    <span
      className={cx('knob', `knob-${size}`, disabled && 'knob-disabled', className)}
      onPointerDown={(e) => {
        if (disabled || e.button !== 0) return
        e.currentTarget.setPointerCapture?.(e.pointerId)
        e.currentTarget.querySelector('input')?.focus({ preventScroll: true })
        drag.current = { x: e.clientX, y: e.clientY, from: value }
      }}
      onPointerMove={(e) => {
        const d = drag.current
        if (!d) return
        const next = dragValue(d.from, dragTravel(d, { x: e.clientX, y: e.clientY }), range)
        if (next !== value) onChange(next)
      }}
      onPointerUp={() => {
        drag.current = null
      }}
      onPointerCancel={() => {
        drag.current = null
      }}
      onDoubleClick={() => {
        if (!disabled && home !== undefined && home !== value) onChange(home)
      }}
    >
      <svg viewBox={`0 0 ${VIEW} ${VIEW}`} aria-hidden="true">
        <circle className="knob-face" cx={CENTRE} cy={CENTRE} r={FACE} />
        <path className="knob-rail" d={arcPath(0, 1, RING)} />
        <path className="knob-value" d={arcPath(centreAt ?? 0, f, RING)} />
        {markAt && <circle className="knob-marker" cx={markAt.x} cy={markAt.y} r={MARKER_R} />}
        <line
          className={cx('knob-pointer', atCentre && 'at-centre')}
          x1={CENTRE}
          y1={CENTRE}
          x2={tip.x}
          y2={tip.y}
        />
      </svg>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={label}
        aria-valuetext={valueText}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </span>
  )
  return title ? <Tooltip text={title}>{knob}</Tooltip> : knob
}
