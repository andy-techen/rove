import { ReactNode } from 'react'
import { t } from '@shared/copy'
import { cx } from '../cx'
import './Panel.css'

interface Props {
  /** Accessible name for the panel. */
  label: string
  title: string
  /** What the panel is for, after the title: the track's name. */
  subject?: string
  /** Controls at the right of the header. */
  actions?: ReactNode
  children: ReactNode
  className?: string
}

/** A titled panel under the timeline (Polish, Music). */
export function Panel({
  label,
  title,
  subject,
  actions,
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
        {actions && <div className="panel-actions">{actions}</div>}
      </header>
      {children}
    </section>
  )
}
