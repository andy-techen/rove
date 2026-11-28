import { t } from '@shared/copy'
import { PERCENT } from '@shared/units'
import { parseTypedNumber } from '../ui/NumberField'
import {
  PARAM_RANGES,
  PolishControl,
  PolishParam,
  PolishSettings,
  clampParam
} from '../../audio/polish/polish'
import { DECIMAL_BELOW } from './constants'

// Units written straight after the number ("35%", "3.3:1") rather than after a space.
const ATTACHED_UNITS = ['%', ':1']

// Reverb mix and tuning correction are stored as fractions but shown, and typed, as
// percentages.
const PERCENT_PARAMS: PolishParam[] = ['reverbMix', 'tuneStrength']
const shownAs = (key: PolishParam): { scale: number; unit: string } =>
  PERCENT_PARAMS.includes(key)
    ? { scale: PERCENT, unit: '%' }
    : { scale: 1, unit: PARAM_RANGES[key].unit }

/** A real parameter as a number and unit the singer reads or types: "-18.0" "dB". */
export function paramDisplay(key: PolishParam, value: number): { number: string; unit: string } {
  const { scale, unit } = shownAs(key)
  const shown = value * scale
  const digits =
    key === 'compRatio' || (Math.abs(shown) < DECIMAL_BELOW && unit !== 'Hz' && unit !== '%')
      ? 1
      : 0
  return { number: shown.toFixed(digits), unit }
}

/** A real parameter for display: "-18.0 dB", "120 Hz", "3.3:1", "35%". */
export function formatParam(key: PolishParam, value: number): string {
  const { number, unit } = paramDisplay(key, value)
  return ATTACHED_UNITS.includes(unit) ? `${number}${unit}` : `${number} ${unit}`
}

/**
 * Reads a typed value in the units shown ("4", "-20 dB", "35" for 35%) and keeps it in
 * the parameter's safe range. Null when it isn't a number.
 */
export function parseParam(key: PolishParam, text: string): number | null {
  const n = parseTypedNumber(text)
  return n === null ? null : clampParam(key, n / shownAs(key).scale)
}

export function withOverride(
  polish: PolishSettings,
  key: PolishParam,
  value: number
): PolishSettings {
  return { ...polish, advanced: { ...polish.advanced, [key]: value } }
}

/** Lets a parameter follow its plain-language slider again. */
export function withoutOverride(polish: PolishSettings, key: PolishParam): PolishSettings {
  const rest = { ...polish.advanced }
  delete rest[key]
  return { ...polish, advanced: rest }
}

/**
 * Whether a control sits away from its suggested value, as far as its slider can show
 * (sliders move in whole percent).
 */
export const offSuggested = (
  polish: PolishSettings,
  suggested: PolishSettings,
  key: PolishControl
): boolean => Math.round(polish[key] * PERCENT) !== Math.round(suggested[key] * PERCENT)

/** A plain-language control's setting as shown under its knob: "65%", or "Off". */
export const amountText = (key: PolishControl, amount: number): string =>
  key === 'tuning' && Math.round(amount * PERCENT) === 0
    ? t('polish.off')
    : t('polish.amount', { percent: Math.round(amount * PERCENT) })

/** A typed percentage for a plain-language control, kept between 0 and 1. */
export function parseAmount(text: string): number | null {
  const n = parseTypedNumber(text)
  return n === null ? null : Math.max(0, Math.min(1, n / PERCENT))
}
