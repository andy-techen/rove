import type { Nudge, SuggestedAmounts, Taste } from './autoPolish'

// Knob values are kept in whole steps of a hundredth: finer than anyone can turn one.
export const STEPS = 100

// Polish's sliders
// Makeup restores roughly half the level the compressor takes away, so turning
// Smoothness up doesn't make the voice suddenly quieter; never more than this.
export const MAKEUP_SHARE = 0.5
export const MAKEUP_MAX_DB = 12
/**
 * Web Audio's compressor adds its own makeup gain, (1/fullRangeGain)^0.6 per the
 * spec: 60% of the reduction a full-scale signal would get. Rove subtracts it so
 * "Makeup gain" means the total, and quiet room noise isn't lifted twice.
 * https://webaudio.github.io/web-audio-api/#DynamicsCompressorOptions-processing
 */
export const SPEC_MAKEUP_SHARE = 0.6

// Reading a take
// Frames analysed between pauses that let the window repaint.
export const FRAMES_PER_CHUNK = 400
export const SIBILANT_SHARE = 0.5
// Hum: most of the energy between lines sits below this.
export const HUM_SHARE = 0.5
// Fewer seconds of singing than this is too little to set anything from.
export const MIN_SINGING_SEC = 5
export const MIN_SIBILANT_FRAMES = 5
// A take clipped where this many samples in a row sit at full scale.
export const CLIP_LEVEL = 0.999
export const CLIP_RUN = 3
export const PERCENT = {
  soft: 0.1,
  median: 0.5,
  loud: 0.95,
  room: 0.2
}

// Auto polish
/**
 * How far auto polish will turn each control, narrower than 0..1, so an odd take can't
 * push a knob to an extreme. Noise reduction may go to 0: in a quiet room, less gating
 * keeps breaths and word endings natural.
 */
export const AUTO_LIMITS: Record<keyof SuggestedAmounts, { min: number; max: number }> = {
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
export const SIBILANCE_REFERENCE_DB = -12
// The gate opens this far above the room, but never closer than this under soft singing.
export const GATE_OVER_ROOM_DB = 6
export const GATE_UNDER_SOFT_DB = 10
// Evenness: with this much spread between soft and strong, compression starts at the
// voice's typical level; each dB more starts it this much lower.
export const USUAL_RANGE_DB = 15
export const MARGIN_PER_RANGE_DB = 0.4
export const MARGIN_LIMITS = { min: -6, max: 3 }
export const TONE_NUDGE: Nudge = { deadDb: 3, perDb: 0.04, up: 0.25, down: 0.25 }
export const CLARITY_NUDGE: Nudge = { ...TONE_NUDGE, down: 0.2 }
export const SIBILANCE_NUDGE: Nudge = { deadDb: 3, perDb: 0.03, up: 0.3, down: 0.2 }
// Clarity is mostly presence; air adds a little.
export const PRESENCE_WEIGHT = 0.7
export const HUM_WARMTH = -0.15
// A control that moved at least this far gets its reason told.
export const REASON_STEP = 0.1
// The singer's taste names a knob once it moved it at least this far; a smaller lean
// just tops up whatever the rules said.
export const TASTE_MARK_STEP = 0.05
/** Bumped when the rules change, so a stored suggestion can say which rules made it. */
export const AUTO_POLISH_VERSION = 1

// Learning the singer's taste
/** The furthest the singer's taste leans a control from what the rules say. */
export const MAX_LEAN = 0.15
// Each song back counts this much less than the one after it, so a new mic or room
// takes over within a dozen or so songs.
export const DECAY = 0.85
// How many songs' worth of "the rules were right" every lean starts from, so one song
// can't swing the next much on its own.
export const PRIOR_SONGS = 2
// Leans smaller than this are left out: under a step on the knob, nobody would hear it.
export const MIN_LEAN = 0.01
// More noise reduction raises the gate, which on another take could cut soft singing;
// only less is learned.
export const MOST: Partial<Record<keyof Taste, number>> = { cleanup: 0 }
