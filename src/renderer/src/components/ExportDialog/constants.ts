// Moving and editing words on the picture

// An arrow key moves words this share of the frame; Shift, further.
export const NUDGE = 0.02
export const NUDGE_FAR = 0.1
// Room around words that still grabs them, in video pixels. The field being typed in gets
// a letter's width spare, so it wraps where the video will.
export const GRAB_PAD = 24
// An empty set of words, or one jsdom can't measure, is this many letters wide.
export const EMPTY_LETTERS = 3
// Long enough for a title and a dedication, short enough to stay a few lines on a phone.
export const WORDS_MAX_LENGTH = 120
// How near (in video pixels) words must come to a line before they're pulled onto it:
// about six screen pixels at the editor's usual size.
export const SNAP_DISTANCE = 24

// The picture editor

// Canvas pixels for the picture's swatch: sharp on a Retina screen at swatch size.
export const THUMBNAIL_SIZE = 64
// Each new set of words starts a little lower than the last, so they don't stack up.
export const NEW_WORDS_STEP = 1 / 6
export const NEW_WORDS_LOWEST = 5 / 6

// The bar over selected text

// Text this near the top (as a share of the frame) gets its bar below it instead of
// above, where it would run off the picture. With the fonts open the bar is taller.
export const BELOW_TOP = 0.12
export const BELOW_TOP_WITH_FONTS = 0.4
// Below this the bar's slide is rounding, not a real change; it stops the layout effect
// re-rendering for nothing.
export const SHIFT_EPSILON_PX = 0.5

// Finding installed fonts

// Big enough that a font's own widths show over rounding.
export const PROBE_PX = 48
