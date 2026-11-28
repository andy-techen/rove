import { ReactNode } from 'react'
import { t } from '@shared/copy'
import { Button } from '../ui/Button'

interface Props {
  locked: boolean
  /** Only a whole line repeats. */
  lineIsFull: boolean
  onAddBar(): void
  onRepeatLine(): void
  /** More actions at the end of the row, after Repeat line. */
  children?: ReactNode
}

/** Under the bars: Add bar at the start of the row, Repeat line at the end. */
export function BarTools({
  locked,
  lineIsFull,
  onAddBar,
  onRepeatLine,
  children
}: Props): React.JSX.Element {
  return (
    <div className="chart-bar-actions">
      <Button size="sm" variant="ghost" icon="plus" disabled={locked} onClick={onAddBar}>
        {t('chords.addBar')}
      </Button>
      <span className="chart-line-actions">
        <Button
          size="sm"
          variant="ghost"
          icon="duplicate"
          disabled={locked || !lineIsFull}
          onClick={onRepeatLine}
        >
          {t('chords.repeatLine')}
        </Button>
        {children}
      </span>
    </div>
  )
}
