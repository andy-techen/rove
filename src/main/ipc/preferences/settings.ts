import { app, ipcMain } from 'electron'
import path from 'node:path'
import { t } from '@shared/copy'
import { SETTINGS_CHANNELS, Settings, parseSettings } from '@shared/preferences/settings'
import { showOpen } from '../files/dialogs'
import { jsonStore } from '../files/jsonStore'
import { DEFAULTS } from './constants'
// With no file, or one we can't read, the defaults stand.
const store = jsonStore('settings.json', parseSettings, DEFAULTS)

let settings = DEFAULTS

/** Where new songs go: the folder the singer chose, or ~/Music/Rove like other music apps. */
export const songsFolder = (): string =>
  settings.songsFolder ?? path.join(app.getPath('music'), 'Rove')

/** Where exports go unless the singer picks elsewhere: the folder they chose, or ~/Music. */
export const exportsFolder = (): string => settings.exportsFolder ?? app.getPath('music')

async function save(next: Settings): Promise<void> {
  settings = next
  await store.save(settings)
}

/** Asks for a folder, starting from `current`; resolves to it, or null if cancelled. */
const chooseFolder = (
  e: Electron.IpcMainInvokeEvent,
  title: string,
  current: string
): Promise<string | null> =>
  showOpen(e, {
    title,
    buttonLabel: t('settings.chooseFolderButton'),
    defaultPath: current,
    properties: ['openDirectory', 'createDirectory']
  })

/**
 * Loads settings before the first window opens and serves them to windows.
 * `onExportsFolder` hears when the singer picks a new exports folder.
 */
export async function registerSettingsIpc(onExportsFolder: () => void): Promise<void> {
  settings = await store.load()
  ipcMain.handle(SETTINGS_CHANNELS.songsFolder, () => songsFolder())
  ipcMain.handle(SETTINGS_CHANNELS.chooseSongsFolder, async (e) => {
    const chosen = await chooseFolder(e, t('settings.chooseFolderTitle'), songsFolder())
    if (!chosen) return null
    await save({ ...settings, songsFolder: chosen })
    return chosen
  })
  ipcMain.handle(SETTINGS_CHANNELS.exportsFolder, () => exportsFolder())
  ipcMain.handle(SETTINGS_CHANNELS.chooseExportsFolder, async (e) => {
    const chosen = await chooseFolder(e, t('settings.chooseExportsTitle'), exportsFolder())
    if (!chosen) return null
    await save({ ...settings, exportsFolder: chosen })
    onExportsFolder()
    return chosen
  })
}
