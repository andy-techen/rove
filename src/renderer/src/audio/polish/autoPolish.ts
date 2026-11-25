import { PolishAmounts, amountFor, defaultPolish } from './polish'
import { PolishReading } from './polishReading'

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

export interface AutoPolish {
  amounts: SuggestedAmounts
  reasons: AutoPolishReason[]
}

/**
 * How far auto polish will turn each control, narrower than 0..1, so an odd take can't
 * push a knob to an extreme. Noise reduction may go to 0: in a quiet room, less gating
 * keeps breaths and word endings natural.
 */
export const AUTO_LIMITS: Record<SuggestedControl, { min: number; max: number }> = {
  cleanup: { min: 0, max: 0.85 },
  clarity: { min: 0.15, max: 0.75 },
  warmth: { min: 0.1, max: 0.8 },
  smoothness: { min: 0.2, max: 0.85 },
  space: { min: 0, max: 0.5 },
  deEss: { min: 0.2, max: 0.8 }
}

/**
 * The tone we expect from a voice, per Hz relative to 1–2 kHz (see `PolishReading`).
 * A starting point to tune by ear across voices and mics, not a rule.
 */
export const TONE_REFERENCE = { bodyDb: 10, presenceDb: -8, airDb: -25 }
/** How sharp "s" sounds usually are: their band's level against the voice's. */
const SIBILANCE_REFERENCE_DB = -12

// The gate opens this far above the room, but never closer than this under soft singing.
const GATE_OVER_ROOM_DB = 6
const GATE_UNDER_SOFT_DB = 10
// Evenness: with this much spread between soft and strong, compression starts at the
// voice's typical level; each dB more starts it this much lower.
const USUAL_RANGE_DB = 15
const MARGIN_PER_RANGE_DB = 0.4
const MARGIN_LIMITS = { min: -6, max: 3 }

/** A bounded step from a reference: nothing inside the dead zone, then a slope, capped. */
interface Nudge {
  deadDb: number
  perDb: number
  up: number
  down: number
}
const TONE_NUDGE: Nudge = { deadDb: 3, perDb: 0.04, up: 0.25, down: 0.25 }
const CLARITY_NUDGE: Nudge = { ...TONE_NUDGE, down: 0.2 }
const SIBILANCE_NUDGE: Nudge = { deadDb: 3, perDb: 0.03, up: 0.3, down: 0.2 }
// Clarity is mostly presence; air adds a little.
const PRESENCE_WEIGHT = 0.7
const HUM_WARMTH = -0.15
// A control that moved at least this far gets its reason told.
const REASON_STEP = 0.1
const STEPS = 100

const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v))

/** How far to move a control, for a measure `shortBy` dB under its reference. */
function nudge(shortBy: number, n: Nudge): number {
  const beyond = Math.max(0, Math.abs(shortBy) - n.deadDb) * n.perDb
  return shortBy > 0 ? Math.min(n.up, beyond) : -Math.min(n.down, beyond)
}

/**
 * Turns what Rove heard into Polish settings for this part. Controls whose effect
 * depends on level (noise reduction, evenness) aim a real parameter at the take and
 * invert the slider; tone controls take bounded steps from the part's defaults.
 */
export function suggestPolish(profile: PolishReading, part: 'lead' | 'harmony'): AutoPolish {
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

  const amounts = Object.fromEntries(
    (Object.keys(raw) as SuggestedControl[]).map((key) => {
      const v = clamp(raw[key], AUTO_LIMITS[key].min, AUTO_LIMITS[key].max)
      // Rounding noise reduction down never lifts the gate above soft singing.
      const round = key === 'cleanup' ? Math.floor : Math.round
      return [key, round(v * STEPS) / STEPS]
    })
  ) as SuggestedAmounts
  return { amounts, reasons: reasonsFor(amounts, base, profile.hum) }
}

const REASONS: Record<SuggestedControl, [up: AutoPolishReason, down: AutoPolishReason] | null> = {
  cleanup: ['noisyRoom', 'quietRoom'],
  smoothness: ['wideRange', 'steadyVoice'],
  deEss: ['sharpS', 'softS'],
  warmth: ['thinVoice', 'fullVoice'],
  clarity: ['dull', 'bright'],
  space: null
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

/** Bumped when the rules change, so a stored suggestion can say which rules made it. */
export const AUTO_POLISH_VERSION = 1

/** A suggestion as stored on a vocal track in `project.json`. */
export interface PolishSuggestion extends AutoPolish {
  /** Which clip windows it heard, so a stale suggestion is recognisable. */
  heard: string
  version: number
}
