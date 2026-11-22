import { app, BrowserWindow, ipcMain } from 'electron'
import { promises as fs } from 'fs'
import path from 'path'
import { KeymapOverrides, effectiveKeymap, parseOverrides } from '@shared/keymap'
import { KEYMAP_CHANNELS } from '@shared/menu'
import { installMenu } from '../menu'

const keymapFile = (): string => path.join(app.getPath('userData'), 'keymap.json')

let overrides: KeymapOverrides = {}

async function load(): Promise<void> {
  try {
    overrides = parseOverrides(JSON.parse(await fs.readFile(keymapFile(), 'utf8')))
  } catch {
    // No file yet, or one we can't read: the defaults stand.
    overrides = {}
  }
}

async function save(raw: unknown): Promise<KeymapOverrides> {
  overrides = parseOverrides(raw)
  const tmp = `${keymapFile()}.tmp`
  await fs.writeFile(tmp, JSON.stringify(overrides, null, 2))
  await fs.rename(tmp, keymapFile())
  installMenu(effectiveKeymap(overrides))
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(KEYMAP_CHANNELS.changed, overrides)
  }
  return overrides
}

/** Loads the person's shortcuts, builds the menu from them, and serves them to windows. */
export async function registerKeymapIpc(): Promise<void> {
  await load()
  installMenu(effectiveKeymap(overrides))
  ipcMain.handle(KEYMAP_CHANNELS.get, () => overrides)
  ipcMain.handle(KEYMAP_CHANNELS.set, (_e, raw: unknown) => save(raw))
  ipcMain.handle(KEYMAP_CHANNELS.capture, (e, on: unknown) => {
    e.sender.setIgnoreMenuShortcuts(on === true)
  })
}
