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

async function save(next: Settings): Promise<void> {
  settings = next
  await store.save(settings)
}

/** Loads settings before the first window opens and serves them to windows. */
export async function registerSettingsIpc(): Promise<void> {
  settings = await store.load()
  ipcMain.handle(SETTINGS_CHANNELS.songsFolder, () => songsFolder())
  ipcMain.handle(SETTINGS_CHANNELS.chooseSongsFolder, async (e) => {
    const chosen = await showOpen(e, {
      title: t('settings.chooseFolderTitle'),
      buttonLabel: t('settings.chooseFolderButton'),
      defaultPath: songsFolder(),
      properties: ['openDirectory', 'createDirectory']
    })
    if (!chosen) return null
    await save({ ...settings, songsFolder: chosen })
    return chosen
  })
}
