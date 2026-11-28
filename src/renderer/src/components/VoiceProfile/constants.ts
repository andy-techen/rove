// Shared by the charts.
// Room below a chart's bottom labels for letters that hang under the line (the p in
// Sharp); without it the scrolling section clips them.
export const LABEL_DESCENT = 4
// The pitch class the keyboard and the growth chart label their octaves at.
export const C = 0

// The keyboard strip.
export const KEYBOARD_HEIGHT = 40
export const KEY_HEIGHT = 24
export const KEY_LABEL_Y = 37
export const KEY_LABEL_INSET = 2
// Keys are told apart by a sliver of background between them, not an outline, as the
// rest of the app separates shapes; without it two white keys (E and F) would merge.
export const KEY_GAP = 1

// The range card.
export const BARS_HEIGHT = 90
export const BAR_GAP = 2
export const BAR_LABEL_INSET = 4
export const BAR_LABEL_Y = 12
export const ROW_HEIGHT = 18
export const ROW_BAR = 10
export const KEYBOARD_GAP = 6
// Enough songs to compare at a glance; the rest wait behind Show all.
export const SONGS_SHOWN = 6
// Song names sit in a column beside their bars, cut short with an ellipsis past this.
export const SONG_NAME_WIDTH = 120
export const SONG_NAME_GAP = 12

// The landing chart.
export const BIN_GAP = 2
export const HEIGHT = 110
export const LABEL_GAP = 16
// Room above the tallest bar for the band's label, so the band shows over every bar
// as the comfort zone does on the range chart.
export const BAND_LABEL_Y = 12
export const HEADROOM = 18
// The soft band in the middle: as close as most listeners hear as on the note.
export const ON_NOTE_CENTS = 20
export const TENTHS = 10

// The growth chart.
// A year at a glance; older months scroll off the left.
export const MAX_MONTHS = 12
export const AXIS_WIDTH = 36
export const PLOT_TOP = 16
export const PLOT_HEIGHT = 170
export const MONTH_LABEL_GAP = 18
export const BAR_WIDTH = 16
export const DOT_RADIUS = 4
export const DOT_LABEL_GAP = 8
export const AXIS_LABEL_NUDGE = 4
