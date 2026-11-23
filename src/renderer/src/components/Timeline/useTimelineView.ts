import { RefObject, useEffect, useRef, useState } from 'react'
import {
  clampScroll,
  followPlayhead,
  minorStep,
  pickTickStep,
  tickTimes,
  timelineLength,
  zoomAround
} from './timelineMath'
import { Command, onCommand } from '../../state/commands/commands'

// Each ⌘= / ⌘− press zooms by this factor.
const ZOOM_STEP = 1.5
// How strongly a wheel/pinch delta zooms; tuned so a trackpad pinch feels natural.
const WHEEL_ZOOM_SENSITIVITY = 0.01
// While recording, the timeline grows in steps this long so the scale (and every
// waveform) isn't recomputed on each animation frame.
const RECORDING_GROWTH_SEC = 30

export interface TimelineView {
  areaRef: RefObject<HTMLDivElement | null>
  sectionRef: RefObject<HTMLElement | null>
  scrollbarRef: RefObject<HTMLDivElement | null>
  areaWidth: number
  pxPerSec: number
  scrollX: number
  contentWidth: number
  zoomed: boolean
  /** Labelled ruler times in view, the step between them, and the finer marks between. */
  ticks: number[]
  tickStep: number
  minorTicks: number[]
  /** View x (px) of a moment on the timeline. */
  x(sec: number): number
  /** Timeline moment under a view x (px). */
  secAt(viewPx: number): number
  zoomIn(): void
  zoomOut(): void
  /** The playhead is on screen; when it isn't, toPlayhead brings it back. */
  playheadVisible: boolean
  /** Scrolls the playhead back to the middle and resumes following it. */
  toPlayhead(): void
  onScrollbar(scrollLeft: number): void
}

function useWidth(): [RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, width]
}

/**
 * Zoom, scroll and playhead-follow for the timeline. Zoom 1 fits the whole song;
 * ⌘/Ctrl + scroll or a pinch zooms around the cursor, a sideways swipe or
 * shift + scroll moves along the song, and the View menu zooms around the playhead.
 */
export function useTimelineView(opts: {
  clipEnds: number[]
  recordingEnd: number
  position: number
  follow: boolean
  /** Respond to the View menu (only the visible tab does). */
  keyboard: boolean
}): TimelineView {
  const [areaRef, areaWidth] = useWidth()
  const sectionRef = useRef<HTMLElement>(null)
  const scrollbarRef = useRef<HTMLDivElement>(null)
  const [view, setView] = useState({ zoom: 1, scrollX: 0 })

  const lengthSec = timelineLength([
    ...opts.clipEnds,
    Math.ceil(opts.recordingEnd / RECORDING_GROWTH_SEC) * RECORDING_GROWTH_SEC
  ])
  const fitPxPerSec = areaWidth / lengthSec
  const pxPerSec = fitPxPerSec * view.zoom
  const contentWidth = lengthSec * pxPerSec
  const scrollX = clampScroll(view.scrollX, contentWidth, areaWidth)

  const step = pickTickStep(pxPerSec)
  const viewFrom = pxPerSec > 0 ? scrollX / pxPerSec : 0
  const viewTo = pxPerSec > 0 ? Math.min(lengthSec, (scrollX + areaWidth) / pxPerSec) : -1
  const ticks = tickTimes(viewFrom, viewTo, step)
  const labelled = new Set(ticks)
  const minorTicks = tickTimes(viewFrom, viewTo, minorStep(step)).filter((t) => !labelled.has(t))

  // Buttons and the View menu zoom around the playhead, so it stays where it was.
  const playheadPx = Math.max(0, Math.min(areaWidth, opts.position * pxPerSec - scrollX))
  const zoomBy = (factor: number, anchorPx: number): void => {
    if (fitPxPerSec <= 0) return
    setView((v) =>
      zoomAround({ ...v, scrollX }, fitPxPerSec, lengthSec, areaWidth, anchorPx, factor)
    )
  }

  // Scrolling by hand during playback lets go of the playhead so the singer can look
  // elsewhere; following picks up again once the playhead is back in view (it caught
  // up, or they clicked to seek there) or when playback starts again.
  const [detached, setDetached] = useState(false)
  const playheadX = opts.position * pxPerSec - scrollX
  const playheadVisible = playheadX >= 0 && playheadX <= areaWidth
  if (detached && (!opts.follow || playheadVisible)) setDetached(false)

  // Keep the playhead in view while it moves. Adjusting during render (guarded so it
  // settles) avoids an extra effect-driven render every frame.
  const followTarget =
    opts.follow && !detached
      ? followPlayhead(opts.position * pxPerSec, scrollX, areaWidth)
      : scrollX
  if (followTarget !== scrollX) setView({ ...view, scrollX: followTarget })
  const scrolledByHand = (): void => {
    if (opts.follow) setDetached(true)
  }

  // Mirror the view into the scrollbar without feeding back into it.
  useEffect(() => {
    const bar = scrollbarRef.current
    if (bar && Math.abs(bar.scrollLeft - scrollX) > 1) bar.scrollLeft = scrollX
  }, [scrollX, contentWidth])

  const toPlayhead = (): void => {
    setDetached(false)
    setView((v) => ({
      ...v,
      scrollX: clampScroll(opts.position * pxPerSec - areaWidth / 2, contentWidth, areaWidth)
    }))
  }

  // Wheel and menu handlers read the latest render through refs.
  const wheel = useRef<(e: WheelEvent) => void>(() => {})
  const menu = useRef<(action: Command) => void>(() => {})
  useEffect(() => {
    wheel.current = (e) => {
      const area = areaRef.current
      if (!area) return
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const anchor = Math.max(0, e.clientX - area.getBoundingClientRect().left)
        zoomBy(Math.exp(-e.deltaY * WHEEL_ZOOM_SENSITIVITY), anchor)
      } else {
        const dx = e.shiftKey ? e.deltaY : e.deltaX
        // Mostly-vertical scrolls belong to the track list.
        if (dx === 0 || (!e.shiftKey && Math.abs(e.deltaX) < Math.abs(e.deltaY))) return
        e.preventDefault()
        scrolledByHand()
        setView((v) => ({ ...v, scrollX: clampScroll(scrollX + dx, contentWidth, areaWidth) }))
      }
    }
    // View menu: zoom around the playhead.
    menu.current = (action) => {
      if (!opts.keyboard) return
      if (action === 'zoomIn') zoomBy(ZOOM_STEP, playheadPx)
      else if (action === 'zoomOut') zoomBy(1 / ZOOM_STEP, playheadPx)
      else if (action === 'zoomFit') setView({ zoom: 1, scrollX: 0 })
      else if (action === 'toPlayhead') toPlayhead()
    }
  })
  useEffect(() => {
    const el = sectionRef.current
    const onWheel = (e: WheelEvent): void => wheel.current(e)
    // Non-passive so ⌘ + scroll can stop the page from zooming instead.
    el?.addEventListener('wheel', onWheel, { passive: false })
    const unsubscribe = onCommand((action) => menu.current(action))
    return () => {
      el?.removeEventListener('wheel', onWheel)
      unsubscribe()
    }
  }, [])

  return {
    areaRef,
    sectionRef,
    scrollbarRef,
    areaWidth,
    pxPerSec,
    scrollX,
    contentWidth,
    zoomed: view.zoom > 1,
    ticks,
    tickStep: step,
    minorTicks,
    x: (sec) => sec * pxPerSec - scrollX,
    secAt: (viewPx) => (viewPx + scrollX) / pxPerSec,
    zoomIn: () => zoomBy(ZOOM_STEP, playheadPx),
    zoomOut: () => zoomBy(1 / ZOOM_STEP, playheadPx),
    playheadVisible,
    toPlayhead,
    onScrollbar: (left) => {
      // The scrollbar echoes our own updates back; only a real drag moves it by more.
      if (Math.abs(scrollX - left) <= 1) return
      scrolledByHand()
      setView((v) => ({ ...v, scrollX: left }))
    }
  }
}
