import { t } from '@shared/copy'
import { cx } from '../cx'
import iconUrl from './icon.svg'
import './Logo.css'

interface Props {
  /** `sm` sits in the top bar; `lg` heads a full screen like the mic check. */
  size?: 'sm' | 'lg'
}

// The rounded lowercase wordmark (design/logo/wordmarks/rounded.svg), drawn as strokes in
// the text colour so it follows the theme.
const WORDMARK = [
  'M0 140V40',
  'M0 90C0 58 22 40 56 42',
  'M78 90A50 50 0 1 0 178 90A50 50 0 1 0 78 90',
  'M210 40C228 40 236 140 252 140C268 140 276 40 294 40',
  'M335 90H434A50 50 0 1 0 420 125'
]
const WORDMARK_STROKE = 28

/** The app icon and the "rove" wordmark, read by assistive tech as the app's name. */
export function Logo({ size = 'sm' }: Props): React.JSX.Element {
  return (
    <span className={cx('logo', `logo-${size}`)} role="img" aria-label={t('app.name')}>
      <img className="logo-icon" src={iconUrl} alt="" draggable={false} />
      <svg className="logo-word" viewBox="-21 19 476 142" aria-hidden="true">
        {WORDMARK.map((d) => (
          <path
            key={d}
            d={d}
            fill="none"
            stroke="currentColor"
            strokeWidth={WORDMARK_STROKE}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </svg>
    </span>
  )
}
