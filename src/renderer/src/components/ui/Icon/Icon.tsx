import { FILLED_ICONS, IconName, STROKE_ICONS } from './icons'
import { STROKE_WIDTH } from './constants'
import './Icon.css'

/**
 * The two icon sizes. Primary is for toolbars (the transport bar, panel tools); secondary
 * is for icons inside text buttons, rows and small inline controls.
 */
export type IconSize = 'primary' | 'secondary'

interface Props {
  name: IconName
  size?: IconSize
}

export function Icon({ name, size = 'primary' }: Props): React.JSX.Element {
  const stroke = name in STROKE_ICONS
  const d = stroke
    ? STROKE_ICONS[name as keyof typeof STROKE_ICONS]
    : FILLED_ICONS[name as keyof typeof FILLED_ICONS]
  return (
    <svg viewBox="0 0 24 24" className={`icon icon-${size}`} aria-hidden="true" data-icon={name}>
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
