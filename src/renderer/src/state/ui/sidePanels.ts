import { Dispatch, SetStateAction, useEffect, useState } from 'react'
import { BOTTOM_HEIGHT, SIDE_WIDTH } from './constants'

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
