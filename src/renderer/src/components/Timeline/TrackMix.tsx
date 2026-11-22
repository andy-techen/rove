import { t } from '@shared/copy'
import { gainToSlider, sliderToGain } from '../../audio/mixer'
import { cx } from '../ui/cx'
import { Icon } from '../ui/Icon'
import { IconButton } from '../ui/IconButton'
import { Slider } from '../ui/Slider'
import { Tooltip } from '../ui/Tooltip'

export interface MixChange {
  volume?: number
  pan?: number
  muted?: boolean
}

interface Props {
  name: string
  volume: number
  /** The track's starting volume, which double-clicking returns to. */
  startVolume: number
  pan: number
  muted: boolean
  locked: boolean
  onMix(change: MixChange): void
}

const PERCENT = 100
const PAN_STEP_PERCENT = 5
// Pans within this distance of the middle read as "Centre".
const CENTRE_TOLERANCE = 0.05
const MIX_ICON_SIZE = 14

const panLabel = (pan: number): string => {
  if (Math.abs(pan) < CENTRE_TOLERANCE) return t('track.centre')
  const percent = Math.round(Math.abs(pan) * PERCENT)
  return pan < 0 ? t('track.panLeft', { percent }) : t('track.panRight', { percent })
}

/** Right side of a lane: the speaker mutes, the sliders set volume and position. */
export function TrackMix({
  name,
  volume,
  startVolume,
  pan,
  muted,
  locked,
  onMix
}: Props): React.JSX.Element {
  const volumePercent = Math.round(gainToSlider(volume) * PERCENT)
  return (
    <div className="track-mix">
      <div className="mix-row">
        <IconButton
          icon={muted ? 'muted' : 'volume'}
          iconSize={MIX_ICON_SIZE}
          className={cx('mute-button', muted && 'muted')}
          aria-pressed={muted}
          label={muted ? t('track.unmute', { name }) : t('track.mute', { name })}
          title={muted ? t('track.mutedTitle') : t('track.muteTitle')}
          disabled={locked}
          onClick={() => onMix({ muted: !muted })}
        />
        <Slider
          tone="muted"
          min={0}
          max={PERCENT}
          value={volumePercent}
          disabled={locked}
          label={t('track.volume', { name })}
          valueText={t('track.volumePercent', { percent: volumePercent })}
          title={t('track.volumeTitle', { percent: volumePercent })}
          onChange={(v) => onMix({ volume: sliderToGain(v / PERCENT) })}
          onDoubleClick={() => onMix({ volume: startVolume })}
        />
      </div>
      <div className="mix-row">
        <Tooltip text={t('track.positionIcon')}>
          <span className="mix-icon" aria-hidden="true">
            <Icon name="pan" size={MIX_ICON_SIZE} />
          </span>
        </Tooltip>
        <Slider
          tone="muted"
          min={-PERCENT}
          max={PERCENT}
          step={PAN_STEP_PERCENT}
          centre={0}
          value={Math.round(pan * PERCENT)}
          disabled={locked}
          label={t('track.position', { name })}
          valueText={panLabel(pan)}
          title={t('track.positionTitle', { where: panLabel(pan) })}
          onChange={(v) => onMix({ pan: v / PERCENT })}
          onDoubleClick={() => onMix({ pan: 0 })}
        />
      </div>
    </div>
  )
}
