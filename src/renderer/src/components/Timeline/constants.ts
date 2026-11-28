// Lanes and clips. Timeline.css takes these as --lane-height and --clip-inset, so the
// stylesheet and the drawn waveforms always agree.
export const LANE_HEIGHT = 88
// Gap between a clip and the top and bottom of its lane.
export const CLIP_INSET = 6
export const CLIP_HEIGHT = LANE_HEIGHT - CLIP_INSET * 2

// Pointer gestures.
// Movement below this many pixels is a click, not a drag: on a clip, or on the
// timeline before a selection box starts.
export const DRAG_THRESHOLD_PX = 4
// A clip edge this close (on screen) to something worth lining up with snaps onto it.
export const SNAP_PX = 8

// The ruler.
// Labelled ruler steps, from a tenth of a second (zoomed right in) to five minutes,
// each with the finer step its unlabelled marks fall on.
export const TICK_STEPS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300]
export const MINOR_STEPS: Record<number, number> = {
  0.1: 0.02,
  0.2: 0.05,
  0.5: 0.1,
  1: 0.2,
  2: 0.5,
  5: 1,
  10: 2,
  15: 5,
  30: 5,
  60: 10,
  120: 30,
  300: 60
}
// Tick times are rounded to this, so 0.1 + 0.2 lands on 0.3 and keys stay stable.
export const TICK_PRECISION = 1000
// Ruler labels stay at least this far apart so they never crowd.
export const MIN_TICK_GAP_PX = 64

// Length and zoom.
// An empty song still shows this much timeline to sing into.
export const MIN_TIMELINE_SEC = 30
// A little room past the last clip, so there's space to keep singing.
export const TAIL_ROOM = 1.05
// Zoomed all the way in, one pixel is 2.5 ms: close enough to trim a breath.
export const MAX_PX_PER_SEC = 400
// Each ⌘= / ⌘− press zooms by this factor.
export const ZOOM_STEP = 1.5
// How strongly a wheel/pinch delta zooms; tuned so a trackpad pinch feels natural.
export const WHEEL_ZOOM_SENSITIVITY = 0.01
// While recording, the timeline grows in steps this long so the scale (and every
// waveform) isn't recomputed on each animation frame.
export const RECORDING_GROWTH_SEC = 30

// Following playback: page ahead when the playhead passes 90% of the view, landing it 10% in.
export const FOLLOW_EDGE = 0.9
export const FOLLOW_LANDING = 0.1

// The track mixer.
export const PAN_STEP_PERCENT = 5
// Pans within this distance of the middle read as "Centre".
export const CENTRE_TOLERANCE = 0.05
