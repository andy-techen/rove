import { BrowserWindow, app, ipcMain, nativeTheme } from 'electron'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { APPEARANCE_CHANNELS, Theme, parseTheme } from '@shared/appearance'
import { refreshMenu } from '../menu'
import { writeAtomically } from './writeAtomically'

const appearanceFile = (): string => path.join(app.getPath('userData'), 'appearance.json')

let theme: Theme = 'system'

export const currentTheme = (): Theme => theme

/** Tells a window which theme is chosen, so the top bar's menu can tick it. */
export const reportTheme = (win: BrowserWindow): void =>
  win.webContents.send(APPEARANCE_CHANNELS.changed, theme)

/**
 * Switches the whole app: Electron's theme source drives the window's
 * prefers-color-scheme (so every colour token follows) and the native menus and dialogs.
 */
export async function setTheme(raw: unknown): Promise<Theme> {
  theme = parseTheme(raw)
  nativeTheme.themeSource = theme
  refreshMenu()
  for (const win of BrowserWindow.getAllWindows()) reportTheme(win)
  try {
    await writeAtomically(appearanceFile(), JSON.stringify({ theme }, null, 2))
  } catch {
    // Not remembered for next time, but the switch still holds for this session.
  }
  return theme
}

/** Applies the saved theme before the first window opens, so it never flashes. */
export async function registerAppearanceIpc(): Promise<void> {
  try {
    theme = parseTheme(JSON.parse(await fs.readFile(appearanceFile(), 'utf8')).theme)
  } catch {
    theme = 'system'
  }
  nativeTheme.themeSource = theme
  ipcMain.handle(APPEARANCE_CHANNELS.set, (_e, raw: unknown) => setTheme(raw))
}
