import type { CSSProperties } from 'react'
import { t } from '@shared/copy'
import type { VocalsState } from '../../state/processing/useVocalRemoval'
import { IconButton } from '../ui/IconButton'
import { Tooltip } from '../ui/Tooltip'
import './VocalsControl.css'

interface Props {
  vocals: VocalsState
  locked: boolean
  onRemove(): void
  onCancel(): void
  onPutBack(): void
}

const PERCENT = 100
const STOP_ICON_SIZE = 12

/** The Music panel's header control for taking the singing out of the song. */
export function VocalsControl({
  vocals,
  locked,
  onRemove,
  onCancel,
  onPutBack
}: Props): React.JSX.Element {
  if (vocals.state === 'removing') {
    const percent = Math.round(vocals.progress * PERCENT)
    return (
      <div className="vocals-control">
        <Tooltip text={t('music.removingVocals')}>
          <div
            className="vocals-ring"
            role="progressbar"
            aria-label={t('music.removingVocals')}
            aria-valuemin={0}
            aria-valuemax={PERCENT}
            aria-valuenow={percent}
            // Runtime geometry: how much of the ring is filled.
            style={{ '--progress': vocals.progress } as CSSProperties}
          />
        </Tooltip>
        <span className="vocals-percent">{t('music.removingPercent', { percent })}</span>
        <IconButton
          icon="stop"
          iconSize={STOP_ICON_SIZE}
          label={t('music.stopRemovingVocals')}
          onClick={onCancel}
        />
      </div>
    )
  }
  return vocals.state === 'removed' ? (
    <IconButton
      icon="vocals"
      label={t('music.restoreVocals')}
      disabled={locked}
      onClick={onPutBack}
    />
  ) : (
    <IconButton
      icon="vocalsOff"
      label={t('music.removeVocals')}
      title={t('music.removeVocalsHint')}
      disabled={locked}
      onClick={onRemove}
    />
  )
}
