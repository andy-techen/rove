import { FILLED_ICONS, IconName, STROKE_ICONS } from './icons'

interface Props {
  name: IconName
  /** Rendered size in px; icons scale from a 24px grid. */
  size?: number
}

const DEFAULT_SIZE = 18
const STROKE_WIDTH = 2

export function Icon({ name, size = DEFAULT_SIZE }: Props): React.JSX.Element {
  const stroke = name in STROKE_ICONS
  const d = stroke
    ? STROKE_ICONS[name as keyof typeof STROKE_ICONS]
    : FILLED_ICONS[name as keyof typeof FILLED_ICONS]
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" data-icon={name}>
      {stroke ? (
        <path
          d={d}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path d={d} fill="currentColor" />
      )}
    </svg>
  )
}
