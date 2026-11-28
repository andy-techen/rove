import { app, BrowserWindow, ipcMain, Menu, MenuItemConstructorOptions } from 'electron'
import { t } from '@shared/copy'
import { RECENT_SONGS } from '@shared/constants'
import { DockChoice, MenuAction, MENU_CHANNELS } from '@shared/preferences/menu'
import { listSongbook } from '../ipc/songs/songbook'
import { separator } from './separator'

let showForDock: (() => Promise<BrowserWindow>) | null = null
// A choice made with no window open, waiting for the new window to take it.
let pending: DockChoice | null = null

/**
 * Right-clicking Rove in the Dock: pick up a recent song, or start or find one, without
 * hunting for the window. `showWindow` brings the window forward, or opens one.
 */
export function installDockMenu(showWindow: () => Promise<BrowserWindow>): void {
  showForDock = showWindow
  ipcMain.handle(MENU_CHANNELS.pendingChoice, () => {
    const choice = pending
    pending = null
    return choice
  })
  void refreshDockMenu()
}

/** Carries out a Dock menu choice in the window, which comes forward for it. */
async function choose(choice: DockChoice, showWindow: () => Promise<BrowserWindow>): Promise<void> {
  if (BrowserWindow.getAllWindows().length === 0) {
    pending = choice
    await showWindow()
    return
  }
  const window = await showWindow()
  if ('action' in choice) window.webContents.send(MENU_CHANNELS.action, choice.action)
  else window.webContents.send(MENU_CHANNELS.openSong, choice.folder)
}

/** Rebuilds the Dock menu's recent songs, after the songs may have changed. */
export async function refreshDockMenu(): Promise<void> {
  const showWindow = showForDock
  if (!app.dock || !showWindow) return
  const click = (choice: DockChoice) => (): void => void choose(choice, showWindow)
  const item = (label: string, action: MenuAction): MenuItemConstructorOptions => ({
    label,
    click: click({ action })
  })
  // The Dock menu is a list to glance at, so a failed read just leaves the songs out.
  const recent = (await listSongbook().catch(() => [])).slice(0, RECENT_SONGS)
  const songs = recent.map((song): MenuItemConstructorOptions => ({
    label: song.name,
    click: click({ folder: song.folder })
  }))
  // A dimmed row titles the songs, as Music's Dock menu does over Recently Played; a
  // macOS section header (type 'header') would draw it smaller and bold instead.
  const recentHeader: MenuItemConstructorOptions = {
    label: t('menu.recentSongs'),
    enabled: false
  }
  app.dock.setMenu(
    Menu.buildFromTemplate([
      item(t('keymap.newSong'), 'newSong'),
      item(t('keymap.open'), 'open'),
      item(t('keymap.songbook'), 'songbook'),
      ...(songs.length ? [separator, recentHeader, ...songs] : [])
    ])
  )
}
