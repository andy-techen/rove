// The voice profile
/** Sung notes, in seconds, needed before the profile shows. */
export const VOICE_UNLOCK_SEC = 180

/** How finely held notes are sorted by how far they land from the note. */
export const LANDING_BIN_CENTS = 5
/** Held notes land between half a semitone flat and half a semitone sharp. */
export const LANDING_RANGE_CENTS = 50
export const LANDING_BINS = (2 * LANDING_RANGE_CENTS) / LANDING_BIN_CENTS

/**
 * Which way of listening made a summary. Raise it when summariseTake changes what it
 * measures, so takes summarised the old way are listened to again.
 */
export const VOICE_ANALYSIS_VERSION = 2
