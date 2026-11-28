/** The plain-language controls, each 0..1. */
export interface PolishAmounts {
  cleanup: number
  clarity: number
  warmth: number
  smoothness: number
  space: number
  deEss: number
  /** Pitch correction: 0 is off, low is natural, high is snappy. */
  tuning: number
}

/** Real parameters, shown behind the Advanced toggle. Any left unset follow the sliders. */
export interface PolishAdvanced {
  gateThresholdDb?: number
  lowCutHz?: number
  warmthDb?: number
  presenceDb?: number
  airDb?: number
  compThresholdDb?: number
  compRatio?: number
  makeupDb?: number
  deEssThresholdDb?: number
  reverbMix?: number
  reverbDecaySec?: number
  /** Share of each note's error that tuning removes, 0..1. */
  tuneStrength?: number
  retuneMs?: number
}

export interface PolishSettings extends PolishAmounts {
  enabled: boolean
  advanced?: PolishAdvanced
}

export type PolishParams = Required<PolishAdvanced>

export type PolishControl = keyof PolishAmounts

/** Display order of the controls; labels and hints live in the copy file. */
export const POLISH_CONTROLS: PolishControl[] = [
  'cleanup',
  'clarity',
  'warmth',
  'smoothness',
  'space',
  'deEss',
  'tuning'
]

/**
 * Our suggested setting for each control. Harmonies sit further back than the
 * lead: less presence, more even, a bit more room.
 */
export function defaultPolish(part: 'lead' | 'harmony' = 'lead'): PolishSettings {
  return part === 'harmony'
    ? {
        enabled: true,
        cleanup: 0.5,
        clarity: 0.35,
        warmth: 0.5,
        smoothness: 0.6,
        space: 0.45,
        deEss: 0.4,
        tuning: 0
      }
    : {
        enabled: true,
        cleanup: 0.5,
        clarity: 0.5,
        warmth: 0.4,
        smoothness: 0.5,
        space: 0.3,
        deEss: 0.4,
        tuning: 0
      }
}

export type PolishParam = keyof PolishParams

/** Safe range for every real parameter: whatever the sliders or Advanced say, it stays inside. */
export const PARAM_RANGES: Record<PolishParam, { min: number; max: number; unit: string }> = {
  gateThresholdDb: { min: -80, max: -30, unit: 'dB' },
  lowCutHz: { min: 40, max: 200, unit: 'Hz' },
  warmthDb: { min: -4, max: 6, unit: 'dB' },
  presenceDb: { min: -3, max: 8, unit: 'dB' },
  airDb: { min: 0, max: 6, unit: 'dB' },
  compThresholdDb: { min: -40, max: 0, unit: 'dB' },
  compRatio: { min: 1, max: 8, unit: ':1' },
  makeupDb: { min: 0, max: 15, unit: 'dB' },
  deEssThresholdDb: { min: -40, max: 0, unit: 'dB' },
  reverbMix: { min: 0, max: 0.6, unit: '' },
  reverbDecaySec: { min: 0.4, max: 4, unit: 's' },
  tuneStrength: { min: 0, max: 1, unit: '' },
  retuneMs: { min: 0, max: 400, unit: 'ms' }
}

/**
 * How each plain-language slider moves the real parameters: the value at slider 0
 * and at slider 1, with a straight line between. Every slider-driven parameter
 * except makeup gain (derived below) is listed here.
 */
const SLIDER_MAP: Record<
  Exclude<PolishParam, 'makeupDb'>,
  { control: PolishControl; at0: number; at1: number }
> = {
  // More clean-up opens the gate only for louder sound, so more noise is held back.
  gateThresholdDb: { control: 'cleanup', at0: -72, at1: -38 },
  // Warmth lowers the low cut (keeping body) and lifts the low-mids.
  lowCutHz: { control: 'warmth', at0: 130, at1: 70 },
  warmthDb: { control: 'warmth', at0: -2, at1: 4 },
  presenceDb: { control: 'clarity', at0: -1, at1: 5 },
  airDb: { control: 'clarity', at0: 0, at1: 4 },
  compThresholdDb: { control: 'smoothness', at0: -6, at1: -30 },
  compRatio: { control: 'smoothness', at0: 1.5, at1: 5 },
  deEssThresholdDb: { control: 'deEss', at0: -6, at1: -32 },
  reverbMix: { control: 'space', at0: 0, at1: 0.35 },
  reverbDecaySec: { control: 'space', at0: 0.8, at1: 2.4 },
  // Low tuning nudges part of the way and slowly, keeping slides and vibrato; high
  // lands right on the note almost at once (the "snappy" pop sound).
  tuneStrength: { control: 'tuning', at0: 0, at1: 1 },
  retuneMs: { control: 'tuning', at0: 250, at1: 5 }
}

/** The plain-language control that moves a real parameter. Makeup follows Smoothness. */
export const controlOf = (param: PolishParam): PolishControl =>
  param === 'makeupDb' ? 'smoothness' : SLIDER_MAP[param].control

// Makeup restores roughly half the level the compressor takes away, so turning
// Smoothness up doesn't make the voice suddenly quieter; never more than this.
const MAKEUP_SHARE = 0.5
const MAKEUP_MAX_DB = 12

const lerp = (a: number, b: number, t: number): number => a + (b - a) * Math.max(0, Math.min(1, t))
/** Keeps a parameter inside its safe range, however it was set. */
export const clampParam = (key: PolishParam, value: number): number =>
  Math.max(PARAM_RANGES[key].min, Math.min(PARAM_RANGES[key].max, value))

/**
 * The slider position that gives a real parameter this value: the inverse of the
 * slider's straight line, stopping at the slider's ends.
 */
export function amountFor(param: Exclude<PolishParam, 'makeupDb'>, value: number): number {
  const { at0, at1 } = SLIDER_MAP[param]
  return Math.max(0, Math.min(1, (value - at0) / (at1 - at0)))
}

/** Turns the plain-language sliders (and any Advanced overrides) into real DSP settings. */
export function polishParams(settings: PolishSettings): PolishParams {
  const mapped = Object.fromEntries(
    Object.entries(SLIDER_MAP).map(([param, { control, at0, at1 }]) => [
      param,
      lerp(at0, at1, settings[control])
    ])
  ) as Omit<PolishParams, 'makeupDb'>
  const { compThresholdDb, compRatio } = mapped
  const fromSliders: PolishParams = {
    ...mapped,
    makeupDb: Math.min(MAKEUP_MAX_DB, -compThresholdDb * (1 - 1 / compRatio) * MAKEUP_SHARE)
  }
  const merged = { ...fromSliders, ...settings.advanced }
  return Object.fromEntries(
    Object.entries(merged).map(([k, v]) => [k, clampParam(k as keyof PolishParams, v as number)])
  ) as PolishParams
}

/**
 * Web Audio's compressor adds its own makeup gain, (1/fullRangeGain)^0.6 per the
 * spec: 60% of the reduction a full-scale signal would get. Rove subtracts it so
 * "Makeup gain" means the total, and quiet room noise isn't lifted twice.
 * https://webaudio.github.io/web-audio-api/#DynamicsCompressorOptions-processing
 */
const SPEC_MAKEUP_SHARE = 0.6

export function builtInMakeupDb(thresholdDb: number, ratio: number): number {
  return SPEC_MAKEUP_SHARE * -thresholdDb * (1 - 1 / ratio)
}
