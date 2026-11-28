import type { ColorScheme } from './colorScheme'

// Theme

// The design tokens are dark unless the system (or the app's theme) asks for light.
export const DEFAULT_SCHEME: ColorScheme = 'dark'

// Panel sizes

/** Side panel width in px: room for a line of lyrics, without crowding the timeline. */
export const SIDE_WIDTH = { min: 240, max: 560, start: 320 }
/** Neither stacked panel may be squeezed below this, so its header and a few lines show. */
export const PANEL_MIN_HEIGHT = 140

/**
 * The panel under the timeline (Polish, Music, Instrumental) keeps one height, whatever
 * it holds, so writing more chords scrolls inside it rather than squeezing the timeline.
 */
// The minimum fits a row of Polish or Music knobs with their names and values; it
// matches --layout-bottom-panel-min, which holds it on short windows too.
export const BOTTOM_HEIGHT = { min: 200, max: 640, start: 300 }
// The Instrumental panel needs more: a line of bars beside the picker with every kind of
// chord showing. Matches --layout-instrumental-panel-min.
export const INSTRUMENTAL_MIN_HEIGHT = 300

// Pointer gestures

// Movement below this many screen pixels is a click, not a drag: on a clip, on the
// timeline before a selection box starts, or on words in the picture editor.
export const DRAG_THRESHOLD_PX = 4
