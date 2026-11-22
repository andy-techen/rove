import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { t } from '@shared/copy'
import { SETTINGS_CHANNELS, Settings, parseSettings } from '@shared/settings'

const settingsFile = (): string => path.join(app.getPath('userData'), 'settings.json')

let settings: Settings = { songsFolder: null }

/** Where new songs go: the folder the singer chose, or ~/Music/Rove like other music apps. */
export const songsFolder = (): string =>
  settings.songsFolder ?? path.join(app.getPath('music'), 'Rove')

async function save(next: Settings): Promise<void> {
  settings = next
  const tmp = `${settingsFile()}.tmp`
  await fs.writeFile(tmp, JSON.stringify(settings, null, 2))
  await fs.rename(tmp, settingsFile())
}

/** Loads settings before the first window opens and serves them to windows. */
export async function registerSettingsIpc(): Promise<void> {
  try {
    settings = parseSettings(JSON.parse(await fs.readFile(settingsFile(), 'utf8')))
  } catch {
    // No file yet, or one we can't read: the defaults stand.
  }
  ipcMain.handle(SETTINGS_CHANNELS.songsFolder, () => songsFolder())
  ipcMain.handle(SETTINGS_CHANNELS.chooseSongsFolder, async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    const options: Electron.OpenDialogOptions = {
      title: t('settings.chooseFolderTitle'),
      buttonLabel: t('settings.chooseFolderButton'),
      defaultPath: songsFolder(),
      properties: ['openDirectory', 'createDirectory']
    }
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)
    const chosen = result.canceled ? undefined : result.filePaths[0]
    if (!chosen) return null
    await save({ ...settings, songsFolder: chosen })
    return chosen
  })
}
