import type { CSSProperties } from 'react'
import { t } from '@shared/copy'
import { PERCENT } from '@shared/units'
import { TimeLeft } from '../../state/song/timeLeft'
import { ExportState } from '../../state/song/useExport'
import { Icon } from '../ui/Icon'

const nameOf = (path: string): string => path.split(/[\\/]/).pop() ?? path
const folderOf = (path: string): string => nameOf(path.split(/[\\/]/).slice(0, -1).join('/'))

function timeLeftText(left: TimeLeft): string {
  return left.kind === 'soon'
    ? t('export.timeLeft.soon')
    : t(`export.timeLeft.${left.kind}`, { count: left.count })
}

/** Where an export has got to: a progress bar while working, then the saved file. */
export function ExportStatus({ state }: { state: ExportState }): React.JSX.Element | null {
  if (state.status === 'idle') return null
  if (state.status === 'failed') {
    return (
      <p className="export-status error" role="alert">
        {t('export.failed')}
      </p>
    )
  }
  if (state.status === 'done') {
    return (
      <div className="export-status" aria-live="polite">
        <span className="export-status-icon">
          <Icon name="check" />
        </span>
        <span className="export-status-text">
          <span className="export-status-name">{nameOf(state.filePath)}</span>
          <span className="export-status-detail">
            {t('export.savedIn', { folder: folderOf(state.filePath) })}
          </span>
        </span>
      </div>
    )
  }
  const { stage, timeLeft } = state
  const label = t(`export.stages.${stage.stage}`)
  // Only encoding knows how far along it is; the steps before it just show they're busy.
  const progress = stage.stage === 'encoding' ? stage.progress : null
  return (
    <div className="export-status working">
      <span className="export-status-row">
        <span>{label}</span>
        {timeLeft && <span className="export-status-detail">{timeLeftText(timeLeft)}</span>}
      </span>
      <div
        className={progress === null ? 'export-progress busy' : 'export-progress'}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={PERCENT}
        aria-valuenow={progress === null ? undefined : Math.round(progress * PERCENT)}
        // Runtime geometry: how much of the bar is filled.
        style={{ '--progress': progress ?? 0 } as CSSProperties}
      />
    </div>
  )
}
