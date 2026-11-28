import { MS_PER_SEC } from '@shared/units'

// Undo and saving

export const LIMIT = 100
export const SAVE_DELAY_MS = 400
// Within this long, "just now" reads better than a count of seconds.
export const JUST_NOW_MS = 10 * MS_PER_SEC

// Moving around the timeline

// Edges this close to the playhead count as "here", so a jump moves on to the next one.
export const EDGE_TOLERANCE_SEC = 0.001
// About one sung line, so ← replays the line just sung (YouTube skips the same).
export const SKIP_SEC = 5

// Export

// An export runs at least this far past the last clip, so nothing ends on a hard cut.
export const MIN_EXPORT_TAIL_SEC = 0.5
// The first moments of encoding are too noisy to guess from: wait for this much progress
// and time before saying how long is left.
export const TIME_LEFT_MIN_PROGRESS = 0.05
export const TIME_LEFT_MIN_ELAPSED_SEC = 1
// Under this, "almost done" beats a countdown that keeps changing.
export const ALMOST_DONE_SEC = 10
// Seconds left are counted in steps this big, so the number doesn't flicker.
export const TIME_LEFT_STEP_SEC = 5
