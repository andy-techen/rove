import type { BrowserWindow, Rectangle } from 'electron'
import { MIN_VISIBLE_WINDOW, WINDOW } from './constants'
import { jsonStore } from './ipc/files/jsonStore'

export interface WindowBounds {
  x?: number
  y?: number
  width: number
  height: number
  maximized: boolean
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

const overlaps = (a: Rectangle, b: Rectangle, by: number): boolean =>
  Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) >= by &&
  Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) >= by

/**
 * Where the window opens, from what was saved last time. A position is kept only while
 * enough of the window would land on a display, so unplugging a monitor can't open it
 * out of reach; without one the system centres it.
 */
export function restoreBounds(saved: unknown, workAreas: Rectangle[]): WindowBounds {
  const s = (saved ?? {}) as Partial<Record<keyof WindowBounds, unknown>>
  if (!finite(s.width) || !finite(s.height)) {
    return { width: WINDOW.width, height: WINDOW.height, maximized: false }
  }
  const size = {
    width: Math.max(Math.round(s.width), WINDOW.minWidth),
    height: Math.max(Math.round(s.height), WINDOW.minHeight)
  }
  const maximized = s.maximized === true
  if (!finite(s.x) || !finite(s.y)) return { ...size, maximized }
  const rect = { x: Math.round(s.x), y: Math.round(s.y), ...size }
  const visible = workAreas.some((area) => overlaps(rect, area, MIN_VISIBLE_WINDOW))
  return visible ? { ...rect, maximized } : { ...size, maximized }
}

const store = jsonStore<unknown>('window.json', (raw) => raw, undefined)

export const loadWindowBounds = (workAreas: Rectangle[]): Promise<WindowBounds> =>
  store.load().then((saved) => restoreBounds(saved, workAreas))

/** Saves the window's size and place as it closes; a maximized one keeps its normal size. */
export function rememberWindowBounds(win: BrowserWindow): void {
  win.on('close', () => {
    void store.save({ ...win.getNormalBounds(), maximized: win.isMaximized() })
  })
}
