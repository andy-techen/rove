import { t } from '@shared/copy'
import { cx } from '../cx'
import iconUrl from './icon.svg'
import { WORDMARK, WORDMARK_STROKE, WORDMARK_VIEWBOX } from './wordmark'
import './Logo.css'

interface Props {
  /** `sm` sits in the top bar; `lg` heads a full screen like the mic check. */
  size?: 'sm' | 'lg'
}

/** The app icon and the "rove" wordmark, read by assistive tech as the app's name. */
export function Logo({ size = 'sm' }: Props): React.JSX.Element {
  return (
    <span className={cx('logo', `logo-${size}`)} role="img" aria-label={t('app.name')}>
      <img className="logo-icon" src={iconUrl} alt="" draggable={false} />
      <svg className="logo-word" viewBox={WORDMARK_VIEWBOX} aria-hidden="true">
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
