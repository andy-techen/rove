import { useEffect, useState } from 'react'

/** Side panel width in px: room for a line of lyrics, without crowding the timeline. */
export const SIDE_WIDTH = { min: 240, max: 560, start: 320 }
/** Neither stacked panel may be squeezed below this, so its header and a few lines show. */
export const PANEL_MIN_HEIGHT = 140

const WIDTH_KEY = 'rove.sidePanels.width'
const SPLIT_KEY = 'rove.sidePanels.lyricsHeight'

// Panel sizes are a preference for this computer, not part of a song.
function recall(key: string): number | null {
  try {
    const n = Number(window.localStorage.getItem(key))
    return Number.isFinite(n) && n > 0 ? n : null
  } catch {
    return null
  }
}

function remember(key: string, value: number): void {
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
