import { BrowserWindow, ipcMain } from 'electron'
import { KeymapOverrides, effectiveKeymap, parseOverrides } from '@shared/preferences/keymap'
import { KEYMAP_CHANNELS, parseContextMenu, MENU_CHANNELS } from '@shared/preferences/menu'
import { installMenu, showContextMenu } from '../../menu'
import { jsonStore } from '../files/jsonStore'

// With no file, or one we can't read, the defaults stand.
const store = jsonStore<KeymapOverrides>('keymap.json', parseOverrides, {})

let overrides: KeymapOverrides = {}

async function save(raw: unknown): Promise<KeymapOverrides> {
  overrides = parseOverrides(raw)
  await store.save(overrides)
  installMenu(effectiveKeymap(overrides))
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(KEYMAP_CHANNELS.changed, overrides)
  }
  return overrides
}

/**
 * Loads the person's shortcuts, builds the menu from them, and serves them to windows;
 * also shows right-click menus, which list the same shortcuts.
 */
export async function registerKeymapIpc(): Promise<void> {
  overrides = await store.load()
  installMenu(effectiveKeymap(overrides))
  ipcMain.handle(KEYMAP_CHANNELS.get, () => overrides)
  ipcMain.handle(KEYMAP_CHANNELS.set, (_e, raw: unknown) => save(raw))
  ipcMain.handle(KEYMAP_CHANNELS.capture, (e, on: unknown) => {
    e.sender.setIgnoreMenuShortcuts(on === true)
  })
  ipcMain.handle(MENU_CHANNELS.context, (e, raw: unknown) =>
    showContextMenu(e.sender, parseContextMenu(raw))
  )
}
