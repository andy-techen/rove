// Knob geometry, in the SVG's 100 × 100 viewBox. A knob turns through 270°, from
// bottom-left to bottom-right like hardware, so its middle sits at 12 o'clock.
export const VIEW = 100
export const CENTRE = VIEW / 2
export const START_DEG = 135
export const SWEEP_DEG = 270
export const HALF_TURN_DEG = 180

// The drawn parts, as radii from the centre.
export const RING = 40
export const POINTER = 26
export const FACE = 30
export const MARKER_R = 4

// Pixels of drag that turn a knob from one end to the other: a short flick, so a knob
// low in the window still has room to go all the way up.
export const DRAG_PX = 100
// Within this share of the range, a centred knob clicks onto its centre.
export const DETENT = 0.04
