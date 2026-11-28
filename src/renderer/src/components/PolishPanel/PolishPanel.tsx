import { useEffect, useRef, useState } from 'react'
import { CopyKey, t } from '@shared/copy'
import {
  PARAM_RANGES,
  POLISH_CONTROLS,
  PolishParam,
  PolishSettings,
  defaultPolish,
  polishParams
} from '../../audio/polish/polish'
import {
  AutoMark,
  AutoPolishReason,
  PolishSuggestion,
  autoMark
} from '../../audio/polish/autoPolish'
import type { AutoPolishMessage, AutoPolishStatus } from '../../state/processing/useAutoPolish'
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

/** The auto-polish button and what it last did. */
export interface AutoPolishControl {
  status: AutoPolishStatus
  message: AutoPolishMessage | null
  clipped: boolean
  /** What Rove heard and set last time it listened; null before it has. */
  suggestion: PolishSuggestion | null
  /** Listening waits while the song plays or records. */
  disabled: boolean
  onListen(): void
}

// A knob's sparkle when auto polish turned it too little to give a reason, or turned
// it for the singer's taste rather than for something it heard.
const MARK_COPY: Partial<Record<AutoMark, CopyKey>> = {
  up: 'polish.auto.turnedUp',
  down: 'polish.auto.turnedDown',
  tasteUp: 'polish.auto.tasteUp',
  tasteDown: 'polish.auto.tasteDown'
}

const AUTO_TITLE: Record<AutoPolishStatus, CopyKey> = {
  ready: 'polish.auto.title',
  stale: 'polish.auto.titleStale',
  noTakes: 'polish.auto.titleNoTakes',
  listening: 'polish.auto.listening'
}

interface Props {
  trackName: string
  part: 'lead' | 'harmony'
  polish: PolishSettings
  auto?: AutoPolishControl
  locked: boolean
  /** `key` groups a slider drag into one undo step. */
  onChange(next: PolishSettings, key?: string): void
  onHide(): void
  /** Advanced opened and doesn't fit: the panel is this many px short. */
  onGrow?(missingPx: number): void
}

const PERCENT = 100
// Advanced sliders move in 1/200ths of their range: fine enough, not fiddly.
const ADVANCED_STEPS = 200
const PARAMS = Object.keys(PARAM_RANGES) as PolishParam[]

export function PolishPanel({
  trackName,
  part,
  polish,
  auto,
  locked,
  onChange,
  onHide,
  onGrow
}: Props): React.JSX.Element {
  const [advanced, setAdvanced] = useState(false)
  const panel = useRef<HTMLElement>(null)
  // Measured once Advanced is on screen, so the room it needs is known.
  useEffect(() => {
    const el = panel.current
    const missing = el ? el.scrollHeight - el.clientHeight : 0
    if (advanced && missing > 0) onGrow?.(missing)
  }, [advanced, onGrow])
  // Reset and the notches always mean the part's defaults, even after auto-polish.
  const sweetSpot = defaultPolish(part)
  const suggestion = auto?.suggestion ?? null
  const markOf = (key: (typeof POLISH_CONTROLS)[number]): string | null => {
    const mark =
      key === 'tuning' || !suggestion ? null : autoMark(key, polish, suggestion, sweetSpot)
    return mark && t(MARK_COPY[mark] ?? `polish.auto.reasons.${mark as AutoPolishReason}`)
  }
  const params = polishParams(polish)
  const overrides = polish.advanced ?? {}

  return (
    <Panel
      ref={panel}
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
              // Says what flipping it does from here, so it reads right either way.
              title={polish.enabled ? t('polish.compareTitle') : t('polish.turnOnTitle')}
              onChange={(enabled) => onChange({ ...polish, enabled })}
            />
          </span>
          {auto && (
            <>
              <IconButton
                icon="sparkle"
                label={t('polish.auto.label')}
                title={t(AUTO_TITLE[auto.status])}
                aria-busy={auto.status === 'listening'}
                disabled={
                  locked ||
                  auto.disabled ||
                  auto.status === 'noTakes' ||
                  auto.status === 'listening'
                }
                onClick={auto.onListen}
              />
            </>
          )}
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
      {auto?.message && (auto.message !== 'done' || auto.clipped) && (
        <p className={cx('polish-status', auto.clipped && 'warning')} role="status">
          {auto.clipped ? t('polish.auto.clipped') : t(`polish.auto.${auto.message}`)}
        </p>
      )}
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
              setBy={markOf(key)}
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
                    iconSize="secondary"
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
