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
