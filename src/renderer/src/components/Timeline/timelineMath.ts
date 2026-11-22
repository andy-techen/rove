import { PeakAccumulator } from '../../audio/peaks'

export { PeakAccumulator }

/** Draws min/max pairs as one vertical bar per canvas pixel, centred vertically. */
export function drawPeaks(
  ctx: CanvasRenderingContext2D,
  peaks: Float32Array,
  height: number
): void {
  const mid = height / 2
  for (let x = 0; x < peaks.length / 2; x++) {
    const top = mid - peaks[x * 2 + 1] * mid
    const bottom = mid - peaks[x * 2] * mid
    ctx.fillRect(x, top, 1, Math.max(1, bottom - top))
  }
}

// Labelled ruler steps, from a tenth of a second (zoomed right in) to five minutes,
// each with the finer step its unlabelled marks fall on.
const TICK_STEPS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300]
const MINOR_STEPS: Record<number, number> = {
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
const TICK_PRECISION = 1000
const SEC_PER_MIN = 60
// Ruler labels stay at least this far apart so they never crowd.
const MIN_TICK_GAP_PX = 64
// An empty song still shows this much timeline to sing into.
const MIN_TIMELINE_SEC = 30
// A little room past the last clip, so there's space to keep singing.
const TAIL_ROOM = 1.05
// Following playback: page ahead when the playhead passes 90% of the view, landing it 10% in.
const FOLLOW_EDGE = 0.9
const FOLLOW_LANDING = 0.1

/** The smallest "round" ruler interval that keeps labels at least `minGapPx` apart. */
export function pickTickStep(pxPerSec: number, minGapPx = MIN_TICK_GAP_PX): number {
  return TICK_STEPS.find((step) => step * pxPerSec >= minGapPx) ?? TICK_STEPS[TICK_STEPS.length - 1]
}

/** The unlabelled step between a labelled step's ticks. */
export const minorStep = (step: number): number => MINOR_STEPS[step] ?? step

/** Every multiple of `step` from `fromSec` to `toSec`, inclusive. */
export function tickTimes(fromSec: number, toSec: number, step: number): number[] {
  const times: number[] = []
  for (let i = Math.max(0, Math.floor(fromSec / step)); i * step <= toSec; i++) {
    times.push(Math.round(i * step * TICK_PRECISION) / TICK_PRECISION)
  }
  return times
}

/** A ruler label: "1:05", or "1:05.5" once ticks are closer than a second. */
export function formatTick(sec: number, step: number): string {
  const minutes = Math.floor(sec / SEC_PER_MIN)
  const seconds = sec - minutes * SEC_PER_MIN
  const shown =
    step < 1 ? seconds.toFixed(1).padStart(4, '0') : String(Math.floor(seconds)).padStart(2, '0')
  return `${minutes}:${shown}`
}

export function timelineLength(endTimes: number[], minSec = MIN_TIMELINE_SEC): number {
  return Math.max(minSec, ...endTimes.map((t) => t * TAIL_ROOM))
}

// Zoomed all the way in, one pixel is 2.5 ms: close enough to trim a breath.
export const MAX_PX_PER_SEC = 400

export function clampScroll(scrollX: number, contentWidth: number, viewWidth: number): number {
  return Math.max(0, Math.min(scrollX, contentWidth - viewWidth))
}

/**
 * Zooms by `factor` while keeping the moment under `anchorPx` (in view px) in
 * place, like zooming a map under the cursor. Zoom 1 fits the whole song.
 */
export function zoomAround(
  view: { zoom: number; scrollX: number },
  fitPxPerSec: number,
  lengthSec: number,
  viewWidth: number,
  anchorPx: number,
  factor: number
): { zoom: number; scrollX: number } {
  const maxZoom = Math.max(1, MAX_PX_PER_SEC / fitPxPerSec)
  const zoom = Math.max(1, Math.min(maxZoom, view.zoom * factor))
  const anchorSec = (anchorPx + view.scrollX) / (fitPxPerSec * view.zoom)
  const pps = fitPxPerSec * zoom
  return { zoom, scrollX: clampScroll(anchorSec * pps - anchorPx, lengthSec * pps, viewWidth) }
}

/** Scrolls just enough to keep a moving playhead on screen, paging ahead near the edge. */
export function followPlayhead(playheadPx: number, scrollX: number, viewWidth: number): number {
  const x = playheadPx - scrollX
  if (x >= 0 && x <= viewWidth * FOLLOW_EDGE) return scrollX
  return Math.max(0, playheadPx - viewWidth * FOLLOW_LANDING)
}
