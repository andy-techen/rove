import { ReactNode } from 'react'
import { t } from '@shared/copy'
import { cx } from '../cx'
import { IconButton } from '../IconButton'
import './Panel.css'

interface Props {
  /** Accessible name for the panel. */
  label: string
  title: string
  /** What the panel is for, after the title: the track's name. */
  subject?: string
  /** Controls at the right of the header. */
  actions?: ReactNode
  /** Shows a hide button at the far right of the header. */
  onHide?: () => void
  children: ReactNode
  className?: string
}

/** A titled panel under the timeline (Polish, Music). */
export function Panel({
  label,
  title,
  subject,
  actions,
  onHide,
  children,
  className
}: Props): React.JSX.Element {
  return (
    <section className={cx('panel', className)} aria-label={label}>
      <header className="panel-header">
        <h2>
          {title}
          {subject && <span className="muted"> {t('panel.subject', { name: subject })}</span>}
        </h2>
        {(actions || onHide) && (
          <div className="panel-actions">
            {actions}
            {onHide && (
              <IconButton icon="hideBottomPanel" label={t('panel.hide')} onClick={onHide} />
            )}
          </div>
        )}
      </header>
      {children}
    </section>
  )
}
