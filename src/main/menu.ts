import { app, BrowserWindow, Menu, MenuItemConstructorOptions, WebContents } from 'electron'
import { is } from '@electron-toolkit/utils'
import { t } from '@shared/copy'
import { KEYMAP, Keymap, ShortcutId, isInAppAccelerator } from '@shared/preferences/keymap'
import { RECENT_SONGS } from '@shared/constants'
import {
  ContextMenuItem,
  MENU_CHANNEL,
  MenuAction,
  OPEN_SONG_CHANNEL
} from '@shared/preferences/menu'
import { THEMES } from '@shared/preferences/appearance'
import { currentTheme, setTheme } from './ipc/preferences/appearance'
import { listSongbook } from './ipc/songs/songbook'

/** Sends a menu choice to the focused window; the renderer decides what it means. */
function send(action: MenuAction): void {
  BrowserWindow.getFocusedWindow()?.webContents.send(MENU_CHANNEL, action)
}

const separator: MenuItemConstructorOptions = { type: 'separator' }

let installed: Keymap | null = null

/** Rebuilds the menu with the current shortcuts, after something it shows has changed. */
export function refreshMenu(): void {
  if (installed) installMenu(installed)
}

/** The native menu bar, rebuilt whenever shortcuts change. The window's own bar holds the songs. */
export function installMenu(keymap: Keymap): void {
  installed = keymap
  /**
   * A menu item for a shortcut. In-app keys (Space, S, arrows…) are shown but not
   * registered: as menu accelerators they would swallow typing and slider keys, so
   * the renderer handles them and the menu just documents them.
   */
  const shortcut = (id: ShortcutId & MenuAction): MenuItemConstructorOptions => ({
    label: t(`keymap.${id}`),
    accelerator: keymap[id],
    registerAccelerator: !isInAppAccelerator(keymap[id]),
    click: () => send(id)
  })

  const template: MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        separator,
        // One item per section of the settings dialog; ⌘, opens Settings itself.
        {
          label: t('menu.settingsMenu'),
          submenu: [
            { label: t('menu.voice'), click: () => send('voice') },
            shortcut('settings'),
            { label: t('menu.premium'), click: () => send('premium') },
            { label: t('menu.shortcuts'), click: () => send('shortcuts') }
          ]
        },
        { label: t('menu.checkMicrophone'), click: () => send('micCheck') },
        separator,
        { role: 'services' },
        separator,
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        separator,
        { role: 'quit' }
      ]
    },
    {
      label: t('keymap.groups.file'),
      submenu: [
        shortcut('newSong'),
        shortcut('open'),
        shortcut('songbook'),
        separator,
        shortcut('save'),
        shortcut('export'),
        separator,
        { label: t('menu.exportProject'), click: () => send('exportProject') },
        { label: t('menu.importProject'), click: () => send('importProject') },
        separator,
        shortcut('moveSongLeft'),
        shortcut('moveSongRight'),
        separator,
        shortcut('closeSong')
      ]
    },
    {
      label: t('keymap.groups.edit'),
      submenu: [
        // Custom items: song edits when the timeline has focus, text edits in a field.
        shortcut('undo'),
        shortcut('redo'),
        separator,
        shortcut('cut'),
        shortcut('copy'),
        shortcut('paste'),
        shortcut('selectAll'),
        separator,
        shortcut('split'),
        shortcut('deleteClip'),
        separator,
        shortcut('groupClips'),
        shortcut('ungroupClips'),
        separator,
        shortcut('moveTrackUp'),
        shortcut('moveTrackDown')
      ]
    },
    {
      label: t('keymap.groups.playback'),
      submenu: [
        shortcut('playPause'),
        shortcut('record'),
        shortcut('stopPlayback'),
        shortcut('restartTake'),
        separator,
        shortcut('goToStart'),
        shortcut('goToEnd'),
        shortcut('skipBack'),
        shortcut('skipForward'),
        shortcut('previousEdge'),
        shortcut('nextEdge')
      ]
    },
    {
      label: t('keymap.groups.view'),
      submenu: [
        shortcut('zoomIn'),
        shortcut('zoomOut'),
        shortcut('zoomFit'),
        shortcut('toPlayhead'),
        separator,
        shortcut('toggleLyrics'),
        shortcut('toggleChords'),
        separator,
        {
          label: t('menu.appearance'),
          submenu: THEMES.map((theme) => ({
            label: t(`menu.themes.${theme}`),
            type: 'radio',
            checked: currentTheme() === theme,
            click: () => void setTheme(theme)
          }))
        },
        ...(is.dev
          ? ([
              separator,
              // ⌘R is Record; reloading the window (development only) moves aside.
              { role: 'reload', accelerator: 'CmdOrCtrl+Alt+R' },
              { role: 'toggleDevTools' }
            ] satisfies MenuItemConstructorOptions[])
          : [])
      ]
    },
    { role: 'windowMenu' }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

let showForDock: (() => Promise<BrowserWindow>) | null = null

/**
 * Right-clicking Rove in the Dock: pick up a recent song, or start or find one, without
 * hunting for the window. `showWindow` brings the window forward (opening one if it was
 * closed) before the choice is sent, since nothing has focus while the Dock menu is open.
 */
export function installDockMenu(showWindow: () => Promise<BrowserWindow>): void {
  showForDock = showWindow
  void refreshDockMenu()
}

/** Rebuilds the Dock menu's recent songs, after the songs may have changed. */
export async function refreshDockMenu(): Promise<void> {
  const showWindow = showForDock
  if (!app.dock || !showWindow) return
  const toWindow =
    (channel: string, payload: string): (() => void) =>
    () =>
      void showWindow().then((window) => window.webContents.send(channel, payload))
  const item = (label: string, action: MenuAction): MenuItemConstructorOptions => ({
    label,
    click: toWindow(MENU_CHANNEL, action)
  })
  // The Dock menu is a list to glance at, so a failed read just leaves the songs out.
  const recent = (await listSongbook().catch(() => [])).slice(0, RECENT_SONGS)
  const songs = recent.map((song): MenuItemConstructorOptions => ({
    label: song.name,
    click: toWindow(OPEN_SONG_CHANNEL, song.folder)
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

const isShortcut = (action: MenuAction): action is MenuAction & ShortcutId => action in KEYMAP

// Actions only right-click menus offer; they have no shortcut, so they're named here.
const CONTEXT_ONLY_LABELS = {
  renameTrack: 'menu.renameTrack',
  removeTrack: 'menu.removeTrack',
  lineUp: 'menu.lineUp',
  syncHarmony: 'menu.syncHarmony',
  makeHarmony: 'menu.makeHarmony',
  makeLead: 'menu.makeLead'
} as const

/**
 * Shows a right-click menu over the window that asked. Rows show their shortcuts as the
 * menu bar does; a choice comes back on the menu channel, like a menu-bar click.
 */
export function showContextMenu(sender: WebContents, items: ContextMenuItem[]): void {
  const window = BrowserWindow.fromWebContents(sender)
  if (!window || items.length === 0) return
  const template = items.map((item): MenuItemConstructorOptions => {
    if (item === 'separator') return separator
    const { action, enabled } = item
    const click = (): void => sender.send(MENU_CHANNEL, action)
    if (isShortcut(action)) {
      return {
        label: t(`keymap.${action}`),
        accelerator: installed?.[action],
        registerAccelerator: false,
        enabled,
        click
      }
    }
    const label = CONTEXT_ONLY_LABELS[action as keyof typeof CONTEXT_ONLY_LABELS]
    return { label: label ? t(label) : action, enabled, click }
  })
  Menu.buildFromTemplate(template).popup({ window })
}
