// Knob geometry, in the SVG's 100 × 100 viewBox. A knob turns through 270°, from
// bottom-left to bottom-right like hardware, so its middle sits at 12 o'clock.

export const VIEW = 100
const CENTRE = VIEW / 2
const START_DEG = 135
const SWEEP_DEG = 270
const HALF_TURN_DEG = 180

// Pixels of vertical drag that turn a knob from one end to the other.
export const DRAG_PX = 160
// Within this share of the range, a centred knob clicks onto its centre.
export const DETENT = 0.04

export interface KnobRange {
  min: number
  max: number
  step: number
  /** The value that means "unchanged", for knobs that turn both ways. */
  centre?: number
}

export const fractionOf = (value: number, { min, max }: KnobRange): number =>
  max > min ? (value - min) / (max - min) : 0

/** The point at `fraction` of the travel, `radius` from the middle. */
export function pointAt(fraction: number, radius: number): { x: number; y: number } {
  const radians = ((START_DEG + SWEEP_DEG * fraction) * Math.PI) / HALF_TURN_DEG
  return { x: CENTRE + radius * Math.cos(radians), y: CENTRE + radius * Math.sin(radians) }
}

const fixed = (n: number): string => n.toFixed(2)

/** An SVG arc along the ring between two fractions of the travel. */
export function arcPath(from: number, to: number, radius: number): string {
  const lo = Math.min(from, to)
  const hi = Math.max(from, to)
  if (hi - lo < 1e-6) return ''
  const a = pointAt(lo, radius)
  const b = pointAt(hi, radius)
  const large = (hi - lo) * SWEEP_DEG > HALF_TURN_DEG ? 1 : 0
  return `M ${fixed(a.x)} ${fixed(a.y)} A ${radius} ${radius} 0 ${large} 1 ${fixed(b.x)} ${fixed(b.y)}`
}

/** The value after dragging `upPx` pixels up (negative: down) from `from`. */
export function dragValue(from: number, upPx: number, range: KnobRange): number {
  const span = range.max - range.min
  const raw = from + (upPx / DRAG_PX) * span
  const stepped = Math.round((raw - range.min) / range.step) * range.step + range.min
  const value = Math.max(range.min, Math.min(range.max, stepped))
  if (range.centre !== undefined && Math.abs(value - range.centre) <= DETENT * span) {
    return range.centre
  }
  return value
}
