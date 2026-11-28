import { app, BrowserWindow, Menu, MenuItemConstructorOptions } from 'electron'
import { is } from '@electron-toolkit/utils'
import { t } from '@shared/copy'
import { Keymap, ShortcutId, isInAppAccelerator } from '@shared/preferences/keymap'
import { MenuAction, MENU_CHANNELS } from '@shared/preferences/menu'
import { THEMES } from '@shared/preferences/appearance'
import { currentTheme, setTheme } from '../ipc/preferences/appearance'
import { separator } from './separator'

/** Sends a menu choice to the focused window; the renderer decides what it means. */
function send(action: MenuAction): void {
  BrowserWindow.getFocusedWindow()?.webContents.send(MENU_CHANNELS.action, action)
}

let installed: Keymap | null = null

/** Rebuilds the menu with the current shortcuts, after something it shows has changed. */
export function refreshMenu(): void {
  if (installed) installMenu(installed)
}

/** The shortcuts the menu bar shows, so right-click menus can show the same keys. */
export function installedKeymap(): Keymap | null {
  return installed
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
