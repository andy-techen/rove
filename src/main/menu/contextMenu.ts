import { BrowserWindow, Menu, MenuItemConstructorOptions, WebContents } from 'electron'
import { t } from '@shared/copy'
import { KEYMAP, ShortcutId } from '@shared/preferences/keymap'
import { ContextMenuItem, MenuAction, MENU_CHANNELS } from '@shared/preferences/menu'
import { installedKeymap } from './appMenu'
import { separator } from './separator'

// Actions only right-click menus offer; they have no shortcut, so they're named here.
const CONTEXT_ONLY_LABELS = {
  renameTrack: 'menu.renameTrack',
  removeTrack: 'menu.removeTrack',
  lineUp: 'menu.lineUp',
  syncHarmony: 'menu.syncHarmony',
  makeHarmony: 'menu.makeHarmony',
  makeLead: 'menu.makeLead'
} as const

const isShortcut = (action: MenuAction): action is MenuAction & ShortcutId => action in KEYMAP

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
    const click = (): void => sender.send(MENU_CHANNELS.action, action)
    if (isShortcut(action)) {
      return {
        label: t(`keymap.${action}`),
        accelerator: installedKeymap()?.[action],
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
