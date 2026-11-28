import { BrowserWindow, ipcMain, nativeTheme } from 'electron'
import {
  APPEARANCE_CHANNELS,
  TextSize,
  Theme,
  parseTextSize,
  parseTheme
} from '@shared/preferences/appearance'
import { refreshMenu } from '../../menu'
import { jsonStore } from '../files/jsonStore'
import { TEXT_SIZE_ZOOM } from './constants'

interface Appearance {
  theme: Theme
  textSize: TextSize
}

const store = jsonStore<Appearance>(
  'appearance.json',
  (raw) => {
    const r = raw as Partial<Record<keyof Appearance, unknown>> | null
    return { theme: parseTheme(r?.theme), textSize: parseTextSize(r?.textSize) }
  },
  { theme: 'system', textSize: 'medium' }
)

let appearance: Appearance = { theme: 'system', textSize: 'medium' }

export const currentTheme = (): Theme => appearance.theme

/** How much a new window zooms its page for the chosen text size. */
export const currentZoom = (): number => TEXT_SIZE_ZOOM[appearance.textSize]

/** Tells a window which theme and text size are chosen, so menus and settings can tick them. */
export function reportAppearance(win: BrowserWindow): void {
  win.webContents.send(APPEARANCE_CHANNELS.changed, appearance.theme)
  win.webContents.send(APPEARANCE_CHANNELS.textSizeChanged, appearance.textSize)
}

async function save(next: Appearance): Promise<void> {
  appearance = next
  for (const win of BrowserWindow.getAllWindows()) reportAppearance(win)
  try {
    await store.save(appearance)
  } catch {
    // Not remembered for next time, but the switch still holds for this session.
  }
}

/**
 * Switches the whole app: Electron's theme source drives the window's
 * prefers-color-scheme (so every colour token follows) and the native menus and dialogs.
 */
export async function setTheme(raw: unknown): Promise<Theme> {
  const theme = parseTheme(raw)
  nativeTheme.themeSource = theme
  await save({ ...appearance, theme })
  refreshMenu()
  return theme
}

async function setTextSize(raw: unknown): Promise<TextSize> {
  const textSize = parseTextSize(raw)
  const zoom = TEXT_SIZE_ZOOM[textSize]
  for (const win of BrowserWindow.getAllWindows()) win.webContents.setZoomFactor(zoom)
  await save({ ...appearance, textSize })
  return textSize
}

/** Applies the saved theme before the first window opens, so it never flashes. */
export async function registerAppearanceIpc(): Promise<void> {
  appearance = await store.load()
  nativeTheme.themeSource = appearance.theme
  ipcMain.handle(APPEARANCE_CHANNELS.set, (_e, raw: unknown) => setTheme(raw))
  ipcMain.handle(APPEARANCE_CHANNELS.setTextSize, (_e, raw: unknown) => setTextSize(raw))
}
