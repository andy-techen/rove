/** Menu IPC: menu choices sent to the window, and the window's right-click menus. */
export const MENU_CHANNELS = {
  /** A menu bar, Dock or right-click menu choice. */
  action: 'menu:action',
  /** A song picked from the Dock menu's recent songs: its folder under the songs folder. */
  openSong: 'menu:openSong',
  /**
   * A Dock menu choice made while no window was open. The new window takes it once its
   * songs have reopened; sent straight away, it would arrive before anything listens.
   */
  pendingChoice: 'menu:pendingChoice',
  /** The window asks the main process to show a right-click menu of these rows. */
  context: 'menu:context'
} as const

// Actions the native application menu sends to the renderer.
export const MENU_ACTIONS = [
  'newSong',
  'open',
  'songbook',
  'save',
  'export',
  'exportProject',
  'importProject',
  'closeSong',
  'moveSongLeft',
  'moveSongRight',
  'micCheck',
  'settings',
  'voice',
  'premium',
  'shortcuts',
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
  'lineUp',
  'syncHarmony',
  'makeHarmony',
  'makeLead',
  'playPause',
  'record',
  'stopPlayback',
  'restartTake',
  'goToStart',
  'goToEnd',
  'skipBack',
  'skipForward',
  'previousEdge',
  'nextEdge',
  'zoomIn',
  'zoomOut',
  'zoomFit',
  'toPlayhead',
  'toggleLyrics',
  'toggleChords'
] as const

export type MenuAction = (typeof MENU_ACTIONS)[number]

export function isMenuAction(value: unknown): value is MenuAction {
  return typeof value === 'string' && (MENU_ACTIONS as readonly string[]).includes(value)
}

export type DockChoice = { action: MenuAction } | { folder: string }

/** Keeps a well-formed choice from the main process; anything else is none. */
export function parseDockChoice(raw: unknown): DockChoice | null {
  if (typeof raw !== 'object' || raw === null) return null
  const { action, folder } = raw as Record<string, unknown>
  if (isMenuAction(action)) return { action }
  return typeof folder === 'string' ? { folder } : null
}

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
/** The system clipboard's text, so Paste can read a chord sheet copied from the web. */
export const CLIPBOARD_TEXT_CHANNEL = 'edit:clipboardText'
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
