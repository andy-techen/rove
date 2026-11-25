import { app, BrowserWindow, Menu, MenuItemConstructorOptions, WebContents } from 'electron'
import { is } from '@electron-toolkit/utils'
import { t } from '@shared/copy'
import { KEYMAP, Keymap, ShortcutId, isInAppAccelerator } from '@shared/keymap'
import { ContextMenuItem, MENU_CHANNEL, MenuAction } from '@shared/menu'
import { THEMES } from '@shared/appearance'
import { currentTheme, setTheme } from './ipc/appearance'

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
        shortcut('settings'),
        { label: t('menu.voice'), click: () => send('voice') },
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
        shortcut('stopPlayback'),
        separator,
        shortcut('goToStart'),
        shortcut('goToEnd'),
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
              { role: 'reload' },
              { role: 'toggleDevTools' }
            ] satisfies MenuItemConstructorOptions[])
          : [])
      ]
    },
    { role: 'windowMenu' },
    { role: 'help', submenu: [{ label: t('menu.help'), click: () => send('help') }] }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

const isShortcut = (action: MenuAction): action is MenuAction & ShortcutId => action in KEYMAP

// Actions only right-click menus offer; they have no shortcut, so they're named here.
const CONTEXT_ONLY_LABELS = {
  renameTrack: 'menu.renameTrack',
  removeTrack: 'menu.removeTrack'
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
