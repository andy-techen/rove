import { useState } from 'react'
import { t } from '@shared/copy'
import {
  PARAM_RANGES,
  POLISH_CONTROLS,
  PolishParam,
  PolishSettings,
  defaultPolish,
  polishParams
} from '../../audio/polish/polish'
import { HelpTip } from '../ui/HelpTip'
import { IconButton } from '../ui/IconButton'
import { KnobControl, KnobRow } from '../ui/KnobControl'
import { Panel } from '../ui/Panel'
import { NumberField } from '../ui/NumberField'
import { Slider } from '../ui/Slider'
import { Switch } from '../ui/Switch'
import { cx } from '../ui/cx'
import {
  amountText,
  formatParam,
  parseAmount,
  offSuggested,
  paramDisplay,
  parseParam,
  withOverride,
  withoutOverride
} from './polishFormat'
import './PolishPanel.css'

interface Props {
  trackName: string
  part: 'lead' | 'harmony'
  polish: PolishSettings
  locked: boolean
  /** `key` groups a slider drag into one undo step. */
  onChange(next: PolishSettings, key?: string): void
  onHide(): void
}

const PERCENT = 100
// Advanced sliders move in 1/200ths of their range: fine enough, not fiddly.
const ADVANCED_STEPS = 200
const RESET_ICON_SIZE = 14
const PARAMS = Object.keys(PARAM_RANGES) as PolishParam[]

export function PolishPanel({
  trackName,
  part,
  polish,
  locked,
  onChange,
  onHide
}: Props): React.JSX.Element {
  const [advanced, setAdvanced] = useState(false)
  const sweetSpot = defaultPolish(part)
  const params = polishParams(polish)
  const overrides = polish.advanced ?? {}

  return (
    <Panel
      label={t('polish.label', { name: trackName })}
      title={t('polish.title')}
      subject={trackName}
      onHide={onHide}
      actions={
        <>
          <span className="polish-switch">
            <Switch
              checked={polish.enabled}
              disabled={locked}
              label={t('polish.switchLabel')}
              hideLabel
              title={t('polish.compareTitle')}
              onChange={(enabled) => onChange({ ...polish, enabled })}
            />
          </span>
          <IconButton
            icon="reset"
            label={t('polish.reset')}
            title={t('polish.resetTitle')}
            disabled={locked}
            onClick={() => onChange({ ...sweetSpot, enabled: polish.enabled })}
          />
          <IconButton
            icon="tune"
            label={t('polish.advanced')}
            title={advanced ? t('polish.hideAdvanced') : t('polish.advancedTitle')}
            aria-expanded={advanced}
            onClick={() => setAdvanced((v) => !v)}
          />
        </>
      }
    >
      <KnobRow dimmed={!polish.enabled}>
        {POLISH_CONTROLS.map((key) => {
          const name = t(`polish.controls.${key}.label`)
          return (
            <KnobControl
              key={key}
              label={name}
              hint={t(`polish.controls.${key}.hint`)}
              value={{
                number: String(Math.round(polish[key] * PERCENT)),
                unit: t('polish.percent')
              }}
              onType={(text) => {
                const amount = parseAmount(text)
                if (amount !== null) onChange({ ...polish, [key]: amount })
              }}
              disabled={locked}
              reset={
                offSuggested(polish, sweetSpot, key)
                  ? {
                      label: t('polish.resetControl', { name }),
                      onReset: () => onChange({ ...polish, [key]: sweetSpot[key] })
                    }
                  : null
              }
              knob={{
                min: 0,
                max: PERCENT,
                value: Math.round(polish[key] * PERCENT),
                marker: Math.round(sweetSpot[key] * PERCENT),
                valueText: amountText(key, polish[key]),
                onChange: (v) => onChange({ ...polish, [key]: v / PERCENT }, `polish:${key}`)
              }}
            />
          )
        })}
      </KnobRow>

      {advanced && (
        <div className={cx('advanced-grid', !polish.enabled && 'polish-off')}>
          {PARAMS.map((key) => {
            const range = PARAM_RANGES[key]
            const custom = key in overrides
            const shown = paramDisplay(key, params[key])
            return (
              <div key={key} className={cx('advanced-control', custom && 'custom')}>
                <span className="advanced-label">
                  {t(`polish.params.${key}`)}
                  <HelpTip text={t(`polish.paramHints.${key}`)} />
                </span>
                <Slider
                  tone={custom ? 'accent' : 'muted'}
                  min={range.min}
                  max={range.max}
                  step={(range.max - range.min) / ADVANCED_STEPS}
                  value={params[key]}
                  disabled={locked}
                  label={t(`polish.params.${key}`)}
                  valueText={formatParam(key, params[key])}
                  onChange={(v) => onChange(withOverride(polish, key, v), `polish-adv:${key}`)}
                />
                <NumberField
                  className="advanced-value"
                  label={t('polish.typeValue', { name: t(`polish.params.${key}`) })}
                  value={shown.number}
                  unit={shown.unit}
                  disabled={locked}
                  onCommit={(text) => {
                    const v = parseParam(key, text)
                    if (v !== null) onChange(withOverride(polish, key, v))
                  }}
                />
                {custom ? (
                  <IconButton
                    icon="reset"
                    iconSize={RESET_ICON_SIZE}
                    label={t('polish.followSlider')}
                    disabled={locked}
                    onClick={() => onChange(withoutOverride(polish, key))}
                  />
                ) : (
                  <span />
                )}
              </div>
            )
          })}
        </div>
      )}
    </Panel>
  )
}
