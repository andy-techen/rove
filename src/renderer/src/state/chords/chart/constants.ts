// Bars

// A bar holds one chord, or two sharing it: what a beginner's chart needs.
export const MAX_CHORDS_PER_BAR = 2
// Absorbs rounding in times, so a chord starting exactly on a bar line lands in that bar.
export const EDGE_SEC = 1e-6
// One arrow-key press moves bar 1 this far on the timeline: fine enough to line a chord
// up by ear, where dragging does the big moves.
export const NUDGE_SEC = 0.02

// Tap tempo

// Taps further apart than this start a new count, so a pause doesn't drag the tempo down.
export const TAP_RESET_SEC = 2
// The last few taps set the tempo: enough to even out a wobble, recent enough to follow.
export const TAPS_COUNTED = 5
