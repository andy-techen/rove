// Actions the native application menu sends to the renderer.

export const MENU_CHANNEL = 'menu:action'

export const MENU_ACTIONS = [
  'newSong',
  'open',
  'save',
  'export',
  'closeSong',
  'moveSongLeft',
  'moveSongRight',
  'micCheck',
  'settings',
  'help',
  'undo',
  'redo',
  'cut',
  'copy',
  'paste',
  'selectAll',
  'split',
  'deleteClip',
  'groupClips',
  'ungroupClips',
  'moveTrackUp',
  'moveTrackDown',
  'renameTrack',
  'removeTrack',
  'playPause',
  'stopPlayback',
  'goToStart',
  'goToEnd',
  'previousEdge',
  'nextEdge',
  'zoomIn',
  'zoomOut',
  'zoomFit',
  'toggleLyrics',
  'toggleChords'
] as const

export type MenuAction = (typeof MENU_ACTIONS)[number]

export function isMenuAction(value: unknown): value is MenuAction {
  return typeof value === 'string' && (MENU_ACTIONS as readonly string[]).includes(value)
}

/** The window asks the main process to show a right-click menu of these rows. */
export const CONTEXT_MENU_CHANNEL = 'menu:context'

/** One row of a right-click menu: an action (dimmed when it can't run now) or a divider. */
export type ContextMenuItem = { action: MenuAction; enabled: boolean } | 'separator'

/** Keeps only well-formed rows from the window; anything else is dropped. */
export function parseContextMenu(raw: unknown): ContextMenuItem[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item: unknown): ContextMenuItem[] => {
    if (item === 'separator') return ['separator']
    if (typeof item !== 'object' || item === null) return []
    const { action, enabled } = item as Record<string, unknown>
    return isMenuAction(action) ? [{ action, enabled: enabled === true }] : []
  })
}

/** The main process tells the window whether it's full screen (macOS hides the window buttons then). */
export const FULL_SCREEN_CHANNEL = 'window:fullScreen'

/** Text editing commands the renderer asks the main process to run natively. */
export const NATIVE_EDIT_CHANNEL = 'edit:native'
export const NATIVE_EDITS = ['undo', 'redo', 'cut', 'copy', 'paste', 'selectAll'] as const
export type NativeEdit = (typeof NATIVE_EDITS)[number]

/** Keymap IPC: read and save the person's rebinds; told to every window when they change. */
export const KEYMAP_CHANNELS = {
  get: 'keymap:get',
  set: 'keymap:set',
  changed: 'keymap:changed',
  // While someone presses new keys for a shortcut, the menu mustn't act on them.
  capture: 'keymap:capture'
} as const
