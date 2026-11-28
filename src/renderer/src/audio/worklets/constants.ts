// The noise gate
export const ATTACK_SEC = 0.002
export const RELEASE_SEC = 0.08
export const OPEN_SEC = 0.003
export const CLOSE_SEC = 0.12
// Stays open briefly after the voice drops, so word endings aren't clipped.
export const HOLD_SEC = 0.05
export const DEFAULT_THRESHOLD_DB = -60
export const DEFAULT_RANGE_DB = -25

// The recorder
// ~85 ms at 48 kHz: batching keeps cross-thread message traffic low.
export const CHUNK_SIZE = 4096
