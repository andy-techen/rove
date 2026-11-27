import { Dispatch, SetStateAction, useEffect, useState } from 'react'

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

const WIDTH_KEY = 'rove.sidePanels.width'
const BOTTOM_KEY = 'rove.bottomPanel.height'
const SPLIT_KEY = 'rove.sidePanels.lyricsHeight'

// Panel sizes are a preference for this computer, not part of a song.
export function recall(key: string): number | null {
  try {
    const n = Number(window.localStorage.getItem(key))
    return Number.isFinite(n) && n > 0 ? n : null
  } catch {
    return null
  }
}

export function remember(key: string, value: number): void {
  try {
    window.localStorage.setItem(key, String(Math.round(value)))
  } catch {
    // Storage off or full: the size still holds for this session.
  }
}

export const clampWidth = (px: number): number =>
  Math.max(SIDE_WIDTH.min, Math.min(SIDE_WIDTH.max, px))

/** The side panels' width, and the lyrics panel's height when chords share the column. */
export function useSidePanelSize(): {
  width: number
  setWidth(px: number): void
  lyricsHeight: number | null
  setLyricsHeight(px: number): void
} {
  const [width, setWidth] = useState(() => clampWidth(recall(WIDTH_KEY) ?? SIDE_WIDTH.start))
  const [lyricsHeight, setLyricsHeight] = useState<number | null>(() => recall(SPLIT_KEY))
  useEffect(() => remember(WIDTH_KEY, width), [width])
  useEffect(() => {
    if (lyricsHeight !== null) remember(SPLIT_KEY, lyricsHeight)
  }, [lyricsHeight])
  return { width, setWidth, lyricsHeight, setLyricsHeight }
}

export const clampBottom = (px: number): number =>
  Math.max(BOTTOM_HEIGHT.min, Math.min(BOTTOM_HEIGHT.max, px))

/**
 * The panel's height once it's `missingPx` short of showing everything: that much
 * taller, within the usual limits, and never shorter than the singer made it.
 */
export const grownBy = (current: number, missingPx: number): number =>
  Math.max(current, clampBottom(current + missingPx))

/** The height of the panel under the timeline, as the singer last dragged it. */
export function useBottomPanelHeight(): {
  height: number
  setHeight: Dispatch<SetStateAction<number>>
} {
  const [height, setHeight] = useState(() => clampBottom(recall(BOTTOM_KEY) ?? BOTTOM_HEIGHT.start))
  useEffect(() => remember(BOTTOM_KEY, height), [height])
  return { height, setHeight }
}
