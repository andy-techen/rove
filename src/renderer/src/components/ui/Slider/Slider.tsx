import { CSSProperties } from 'react'
import { cx } from '../cx'
import { Tooltip } from '../Tooltip'
import './Slider.css'

interface Props {
  value: number
  min: number
  max: number
  step?: number
  onChange(value: number): void
  /** Accessible name. */
  label: string
  /** Spoken value, e.g. "40% left". */
  valueText?: string
  title?: string
  disabled?: boolean
  /**
   * For sliders that go both ways (position): the value that means "unchanged". The
   * fill grows from it, a line marks it, and the slider clicks onto it when close.
   */
  centre?: number
  /** A suggested point along the track (0..1), shown as a small green dot. */
  marker?: number
  tone?: 'accent' | 'muted'
  className?: string
  onDoubleClick?(): void
}

// Within this share of the range, a centred slider settles exactly on its centre.
const DETENT = 0.06

export function Slider({
  value,
  min,
  max,
  step,
  onChange,
  label,
  valueText,
  title,
  disabled,
  centre,
  marker,
  tone = 'accent',
  className,
  onDoubleClick
}: Props): React.JSX.Element {
  const span = max - min
  const at = (v: number): number => (span > 0 ? (v - min) / span : 0)
  const from = centre === undefined ? 0 : at(centre)
  // Runtime geometry: where the fill, centre line and dot sit along this track.
  const geometry = {
    '--fill-from': Math.min(from, at(value)),
    '--fill-to': Math.max(from, at(value)),
    '--centre': from,
    '--marker': marker ?? 0
  } as CSSProperties

  const slider = (
    <span
      className={cx('slider', `slider-${tone}`, disabled && 'slider-disabled', className)}
      style={geometry}
    >
      <span className="slider-track" aria-hidden="true" />
      <span className="slider-fill" aria-hidden="true" />
      {centre !== undefined && <span className="slider-centre" aria-hidden="true" />}
      {marker !== undefined && <span className="slider-marker" aria-hidden="true" />}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={label}
        aria-valuetext={valueText}
        onChange={(e) => {
          const v = Number(e.target.value)
          const snapped = centre !== undefined && Math.abs(v - centre) <= DETENT * span
          onChange(snapped ? centre : v)
        }}
        onDoubleClick={onDoubleClick}
      />
    </span>
  )
  return title ? <Tooltip text={title}>{slider}</Tooltip> : slider
}
