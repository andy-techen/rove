import { PolishAmounts, amountFor, defaultPolish } from './polish'
import { PolishReading } from './polishReading'
import { clamp } from '../dsp/units'
import {
  STEPS,
  AUTO_LIMITS,
  TONE_REFERENCE,
  SIBILANCE_REFERENCE_DB,
  GATE_OVER_ROOM_DB,
  GATE_UNDER_SOFT_DB,
  USUAL_RANGE_DB,
  MARGIN_PER_RANGE_DB,
  MARGIN_LIMITS,
  TONE_NUDGE,
  CLARITY_NUDGE,
  SIBILANCE_NUDGE,
  PRESENCE_WEIGHT,
  HUM_WARMTH,
  REASON_STEP,
  TASTE_MARK_STEP
} from './constants'

/** Auto polish sets every control but Tuning, which changes the singing itself. */
export type SuggestedAmounts = Omit<PolishAmounts, 'tuning'>
type SuggestedControl = keyof SuggestedAmounts

/** What Rove heard that moved a control, in the singer's terms (copy: `polish.auto.reasons`). */
export type AutoPolishReason =
  | 'balanced'
  | 'noisyRoom'
  | 'quietRoom'
  | 'hum'
  | 'wideRange'
  | 'steadyVoice'
  | 'sharpS'
  | 'softS'
  | 'thinVoice'
  | 'fullVoice'
  | 'dull'
  | 'bright'

/**
 * How far to lean each control from what the rules say, learned from where the singer
 * left the knobs on songs auto polish set before (`audio/polish/taste.ts`).
 */
export type Taste = Partial<Record<SuggestedControl, number>>

export interface AutoPolish {
  amounts: SuggestedAmounts
  /** Why the rules moved the controls; the singer's taste is told apart, in `taste`. */
  reasons: AutoPolishReason[]
  /** How far the singer's taste moved each control, beyond the rules; absent when it didn't. */
  taste?: Taste
}

/** A bounded step from a reference: nothing inside the dead zone, then a slope, capped. */
export interface Nudge {
  deadDb: number
  perDb: number
  up: number
  down: number
}

/** How far to move a control, for a measure `shortBy` dB under its reference. */
function nudge(shortBy: number, n: Nudge): number {
  const beyond = Math.max(0, Math.abs(shortBy) - n.deadDb) * n.perDb
  return shortBy > 0 ? Math.min(n.up, beyond) : -Math.min(n.down, beyond)
}

/** Keeps a control inside auto polish's limits, in whole steps. */
function settle(key: SuggestedControl, value: number): number {
  const v = clamp(value, AUTO_LIMITS[key].min, AUTO_LIMITS[key].max)
  // Rounding noise reduction down never lifts the gate above soft singing.
  const round = key === 'cleanup' ? Math.floor : Math.round
  return round(v * STEPS) / STEPS
}

/**
 * Turns what Rove heard into Polish settings for this part. Controls whose effect
 * depends on level (noise reduction, evenness) aim a real parameter at the take and
 * invert the slider; tone controls take bounded steps from the part's defaults. The
 * singer's taste then leans each one, still inside the same limits.
 */
export function suggestPolish(
  profile: PolishReading,
  part: 'lead' | 'harmony',
  taste: Taste = {}
): AutoPolish {
  const base = defaultPolish(part)
  // Level-aimed controls keep the part's offset from the lead (a harmony sits more even).
  const lead = defaultPolish('lead')
  const partOffset = (key: SuggestedControl): number => base[key] - lead[key]

  const gate = Math.min(profile.noiseDb + GATE_OVER_ROOM_DB, profile.softDb - GATE_UNDER_SOFT_DB)
  const margin = clamp(
    (USUAL_RANGE_DB - profile.rangeDb) * MARGIN_PER_RANGE_DB,
    MARGIN_LIMITS.min,
    MARGIN_LIMITS.max
  )
  const toneShort = (measured: number, reference: number): number => reference - measured
  const clarityShort =
    PRESENCE_WEIGHT * toneShort(profile.presenceDb, TONE_REFERENCE.presenceDb) +
    (1 - PRESENCE_WEIGHT) * toneShort(profile.airDb, TONE_REFERENCE.airDb)

  const raw: SuggestedAmounts = {
    cleanup: amountFor('gateThresholdDb', gate) + partOffset('cleanup'),
    smoothness: amountFor('compThresholdDb', profile.voiceDb + margin) + partOffset('smoothness'),
    deEss:
      profile.sibilanceDb === null
        ? base.deEss
        : // Sharper than usual counts like "short of smooth": more smoothing.
          base.deEss +
          nudge(profile.sibilanceDb - profile.voiceDb - SIBILANCE_REFERENCE_DB, SIBILANCE_NUDGE),
    warmth:
      base.warmth +
      nudge(toneShort(profile.bodyDb, TONE_REFERENCE.bodyDb), TONE_NUDGE) +
      (profile.hum ? HUM_WARMTH : 0),
    clarity: base.clarity + nudge(clarityShort, CLARITY_NUDGE),
    space: base.space
  }

  const keys = Object.keys(raw) as SuggestedControl[]
  const ruled = Object.fromEntries(keys.map((key) => [key, settle(key, raw[key])]))
  const amounts = Object.fromEntries(
    keys.map((key) => [key, settle(key, raw[key] + (taste[key] ?? 0))])
  ) as SuggestedAmounts
  const leaned = Object.fromEntries(
    keys.flatMap((key) => {
      const moved = Math.round((amounts[key] - ruled[key]) * STEPS) / STEPS
      return moved ? [[key, moved]] : []
    })
  ) as Taste
  // Reasons tell what Rove heard, so they come from the rules alone.
  const reasons = reasonsFor(ruled as SuggestedAmounts, base, profile.hum)
  return Object.keys(leaned).length ? { amounts, reasons, taste: leaned } : { amounts, reasons }
}

/** Auto polish's rules alone, for a take: what the singer's taste is measured from. */
export const ruledPolish = (profile: PolishReading, part: 'lead' | 'harmony'): SuggestedAmounts =>
  suggestPolish(profile, part).amounts

const REASONS: Record<SuggestedControl, [up: AutoPolishReason, down: AutoPolishReason] | null> = {
  cleanup: ['noisyRoom', 'quietRoom'],
  smoothness: ['wideRange', 'steadyVoice'],
  deEss: ['sharpS', 'softS'],
  warmth: ['thinVoice', 'fullVoice'],
  clarity: ['dull', 'bright'],
  space: null
}

/** What a knob's sparkle says: why auto polish turned it, or at least which way. */
export type AutoMark = AutoPolishReason | 'up' | 'down' | 'tasteUp' | 'tasteDown'

/**
 * The mark on a control auto polish turned, while it still sits where auto polish left
 * it; null for one it left alone or the singer has since moved.
 */
export function autoMark(
  key: SuggestedControl,
  now: PolishAmounts,
  suggestion: AutoPolish,
  defaults: PolishAmounts
): AutoMark | null {
  const set = suggestion.amounts[key]
  if (set === defaults[key] || now[key] !== set) return null
  const up = set > defaults[key]
  const leaned = suggestion.taste?.[key] ?? 0
  if (Math.abs(leaned) >= TASTE_MARK_STEP) return leaned > 0 ? 'tasteUp' : 'tasteDown'
  const own = suggestion.reasons.find((r) => REASONS[key]?.includes(r))
  if (own) return own
  // Hum explains a lower Warmth (as in reasonsFor), never a higher one.
  if (key === 'warmth' && !up && suggestion.reasons.includes('hum')) return 'hum'
  return up ? 'up' : 'down'
}

function reasonsFor(
  amounts: SuggestedAmounts,
  base: PolishAmounts,
  hum: boolean
): AutoPolishReason[] {
  const reasons = (Object.keys(REASONS) as SuggestedControl[]).flatMap((key) => {
    const pair = REASONS[key]
    const moved = amounts[key] - base[key]
    if (!pair || Math.abs(moved) < REASON_STEP) return []
    // Hum explains a lower Warmth on its own.
    if (key === 'warmth' && hum && moved < 0) return []
    return [moved > 0 ? pair[0] : pair[1]]
  })
  if (hum) reasons.push('hum')
  return reasons.length ? reasons : ['balanced']
}

/** A suggestion as stored on a vocal track in `project.json`. */
export interface PolishSuggestion extends AutoPolish {
  /** Which clip windows it heard, so a stale suggestion is recognisable. */
  heard: string
  version: number
  /**
   * What it heard, so later songs can learn the singer's taste by comparing where they
   * left the knobs with what the rules say. Older suggestions have none.
   */
  reading?: PolishReading
}
