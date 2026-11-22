// Every keyboard shortcut in Rove, in one place. The native menu takes its
// accelerators from here, the renderer matches its own keys against it, tooltips
// show its keys, and the Help panel lists it. People can rebind any shortcut; their
// changes are stored as overrides of these defaults.

export type ShortcutGroup = 'file' | 'edit' | 'playback' | 'view'

export interface Shortcut {
  group: ShortcutGroup
  /** The default keys, in Electron accelerator syntax ("CmdOrCtrl+Shift+Z"). */
  accelerator: string
  /** Not in the menu bar, so the renderer handles its keys whatever they are. */
  menu?: false
  /** Shown in Help, but not a key press (e.g. "⌘ + scroll"); can't be rebound. */
  gesture?: true
}

export const KEYMAP = {
  settings: { group: 'file', accelerator: 'CmdOrCtrl+,' },
  newSong: { group: 'file', accelerator: 'CmdOrCtrl+N' },
  open: { group: 'file', accelerator: 'CmdOrCtrl+O' },
  // Beside Open: the other way to open a song.
  songbook: { group: 'file', accelerator: 'CmdOrCtrl+Shift+O' },
  save: { group: 'file', accelerator: 'CmdOrCtrl+S' },
  export: { group: 'file', accelerator: 'CmdOrCtrl+Shift+E' },
  closeSong: { group: 'file', accelerator: 'CmdOrCtrl+W' },
  // Three modifiers keep these clear of text editing (⌘⇧← selects to the line start).
  moveSongLeft: { group: 'file', accelerator: 'CmdOrCtrl+Alt+Shift+Left' },
  moveSongRight: { group: 'file', accelerator: 'CmdOrCtrl+Alt+Shift+Right' },
  undo: { group: 'edit', accelerator: 'CmdOrCtrl+Z' },
  redo: { group: 'edit', accelerator: 'CmdOrCtrl+Shift+Z' },
  cut: { group: 'edit', accelerator: 'CmdOrCtrl+X' },
  copy: { group: 'edit', accelerator: 'CmdOrCtrl+C' },
  paste: { group: 'edit', accelerator: 'CmdOrCtrl+V' },
  selectAll: { group: 'edit', accelerator: 'CmdOrCtrl+A' },
  split: { group: 'edit', accelerator: 'CmdOrCtrl+T' },
  deleteClip: { group: 'edit', accelerator: 'Backspace' },
  groupClips: { group: 'edit', accelerator: 'CmdOrCtrl+G' },
  ungroupClips: { group: 'edit', accelerator: 'CmdOrCtrl+Shift+G' },
  moveTrackUp: { group: 'edit', accelerator: 'CmdOrCtrl+Alt+Up' },
  moveTrackDown: { group: 'edit', accelerator: 'CmdOrCtrl+Alt+Down' },
  deselect: { group: 'edit', accelerator: 'Escape', menu: false },
  playPause: { group: 'playback', accelerator: 'Space' },
  stopPlayback: { group: 'playback', accelerator: 'CmdOrCtrl+.' },
  goToStart: { group: 'playback', accelerator: 'CmdOrCtrl+Left' },
  goToEnd: { group: 'playback', accelerator: 'CmdOrCtrl+Right' },
  previousEdge: { group: 'playback', accelerator: 'Left' },
  nextEdge: { group: 'playback', accelerator: 'Right' },
  zoomIn: { group: 'view', accelerator: 'CmdOrCtrl+=' },
  zoomOut: { group: 'view', accelerator: 'CmdOrCtrl+-' },
  zoomFit: { group: 'view', accelerator: 'CmdOrCtrl+0' },
  toggleLyrics: { group: 'view', accelerator: 'CmdOrCtrl+L' },
  toggleChords: { group: 'view', accelerator: 'CmdOrCtrl+K' },
  zoomGesture: { group: 'view', accelerator: 'CmdOrCtrl+Scroll', gesture: true }
} as const satisfies Record<string, Shortcut>

export type ShortcutId = keyof typeof KEYMAP

export const SHORTCUT_IDS = Object.keys(KEYMAP) as ShortcutId[]

export const SHORTCUT_GROUPS: ShortcutGroup[] = ['file', 'edit', 'playback', 'view']

/** Every shortcut's current keys. */
export type Keymap = Record<ShortcutId, string>

/** The shortcuts someone has changed, and their new keys. */
export type KeymapOverrides = Partial<Record<ShortcutId, string>>

export const isGesture = (id: ShortcutId): boolean => 'gesture' in KEYMAP[id]

export function effectiveKeymap(overrides: KeymapOverrides): Keymap {
  const keymap = {} as Keymap
  for (const id of SHORTCUT_IDS) keymap[id] = overrides[id] ?? KEYMAP[id].accelerator
  return keymap
}

// --- Accelerators ---------------------------------------------------------------

// Stored in this order, so the same keys always compare equal.
const MODIFIERS = ['CmdOrCtrl', 'Alt', 'Shift'] as const

// Physical keys (KeyboardEvent.code) that can end a shortcut, by accelerator name.
// Codes rather than characters: ⌥ and ⇧ change the character but not the key.
const CODE_KEYS: Record<string, string> = {
  Space: 'Space',
  Backspace: 'Backspace',
  // The forward-delete key does what Backspace does here.
  Delete: 'Backspace',
  Enter: 'Return',
  Tab: 'Tab',
  Escape: 'Escape',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
  Backslash: '\\',
  Backquote: '`'
}

const keyFromCode = (code: string): string | null => {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3)
  if (/^Digit[0-9]$/.test(code)) return code.slice(5)
  if (/^F([1-9]|1[0-2])$/.test(code)) return code
  return CODE_KEYS[code] ?? null
}

const KEY_NAMES = new Set([
  ...Object.values(CODE_KEYS),
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  ...Array.from({ length: 12 }, (_, i) => `F${i + 1}`)
])

// Keys that move a cursor or slider; shortcuts on them give way to any focused control.
const NAVIGATION_KEYS = new Set([
  'Left',
  'Right',
  'Up',
  'Down',
  'Home',
  'End',
  'PageUp',
  'PageDown'
])

// Keys a text field uses even with ⌘ held (⌘← jumps to the line start, ⌘⌫ deletes it),
// so the menu must not grab them; the renderer handles them outside text fields.
const TEXT_KEYS = new Set([...NAVIGATION_KEYS, 'Backspace'])

// Taken by macOS, the standard app menu, or keyboard focus.
const RESERVED = new Set([
  'CmdOrCtrl+Q',
  'CmdOrCtrl+H',
  'CmdOrCtrl+Alt+H',
  'CmdOrCtrl+M',
  'CmdOrCtrl+`',
  'Tab',
  'Shift+Tab',
  'Return',
  'Escape'
])

const split = (accelerator: string): { mods: string[]; key: string } => {
  // "CmdOrCtrl+=" splits into "CmdOrCtrl" and "="; a lone "+" isn't a supported key.
  const parts = accelerator.split('+')
  return { mods: parts.slice(0, -1), key: parts[parts.length - 1] }
}

/** Is this a well-formed accelerator Rove can listen for? */
export function isValidAccelerator(accelerator: string): boolean {
  const { mods, key } = split(accelerator)
  const known = MODIFIERS as readonly string[]
  return (
    KEY_NAMES.has(key) &&
    mods.every((m) => known.includes(m)) &&
    // In canonical order with no repeats.
    mods.join('+') === known.filter((m) => mods.includes(m)).join('+')
  )
}

export const isReserved = (accelerator: string): boolean => RESERVED.has(accelerator)

/**
 * Would typing set this off? A letter, number or symbol with no modifier but ⇧ is
 * text, and a shortcut on it fires the moment focus slips out of a text field.
 * Space is the exception: it's play/pause everywhere, and it isn't a character.
 */
export function typesText(accelerator: string): boolean {
  const { mods, key } = split(accelerator)
  return key.length === 1 && mods.every((m) => m === 'Shift')
}

interface KeyEventLike {
  key: string
  code: string
  metaKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
}

/** The accelerator for a key press, or null for a lone modifier or an unsupported key. */
export function acceleratorFromEvent(e: KeyEventLike): string | null {
  const key = keyFromCode(e.code)
  if (!key) return null
  const mods = [
    (e.metaKey || e.ctrlKey) && 'CmdOrCtrl',
    e.altKey && 'Alt',
    e.shiftKey && 'Shift'
  ].filter((m): m is string => !!m)
  return [...mods, key].join('+')
}

/** Does this key press match the accelerator? Modifiers must match exactly. */
export function matchesAccelerator(e: KeyEventLike, accelerator: string): boolean {
  return acceleratorFromEvent(e) === accelerator
}

/**
 * Is a shortcut handled by the renderer rather than a menu accelerator? Single keys
 * (S, Space) would swallow typing as menu accelerators, and text keys (⌘←) belong to
 * text fields; the menu still shows them, without registering them.
 */
export function isInAppAccelerator(accelerator: string): boolean {
  const { mods, key } = split(accelerator)
  return !mods.some((m) => m === 'CmdOrCtrl' || m === 'Alt') || TEXT_KEYS.has(key)
}

/** Does the renderer listen for this shortcut's keys itself? */
export const handledInApp = (id: ShortcutId, accelerator: string): boolean =>
  !isGesture(id) && ('menu' in KEYMAP[id] || isInAppAccelerator(accelerator))

/** Arrow-style shortcuts give way to any focused control (a slider), not just text fields. */
export const yieldsToControls = (accelerator: string): boolean =>
  NAVIGATION_KEYS.has(split(accelerator).key)

// --- Overrides ------------------------------------------------------------------

export type KeymapProblem =
  | { kind: 'invalid' }
  | { kind: 'typing' }
  | { kind: 'reserved' }
  | { kind: 'taken'; by: ShortcutId }

/** Why these keys can't be given to this shortcut, or null if they can. */
export function checkAccelerator(
  keymap: Keymap,
  id: ShortcutId,
  accelerator: string
): KeymapProblem | null {
  if (!isValidAccelerator(accelerator)) return { kind: 'invalid' }
  if (typesText(accelerator)) return { kind: 'typing' }
  if (isReserved(accelerator)) return { kind: 'reserved' }
  const by = SHORTCUT_IDS.find((other) => other !== id && keymap[other] === accelerator)
  return by ? { kind: 'taken', by } : null
}

/**
 * Reads stored overrides, keeping only rebinds Rove can honour: known shortcuts,
 * valid unreserved keys that typing can't set off (older versions allowed single
 * letters), and no two shortcuts on the same keys (both clashing
 * overrides are dropped, so a hand-edited file can't break the defaults).
 */
export function parseOverrides(raw: unknown): KeymapOverrides {
  if (typeof raw !== 'object' || raw === null) return {}
  const entries = Object.entries(raw as Record<string, unknown>).filter(
    (entry): entry is [ShortcutId, string] => {
      const [id, accelerator] = entry
      return (
        id in KEYMAP &&
        !isGesture(id as ShortcutId) &&
        typeof accelerator === 'string' &&
        isValidAccelerator(accelerator) &&
        !typesText(accelerator) &&
        !isReserved(accelerator) &&
        accelerator !== KEYMAP[id as ShortcutId].accelerator
      )
    }
  )
  let overrides: KeymapOverrides = Object.fromEntries(entries)
  for (;;) {
    const keymap = effectiveKeymap(overrides)
    const clashing = (Object.keys(overrides) as ShortcutId[]).filter((id) =>
      SHORTCUT_IDS.some((other) => other !== id && keymap[other] === keymap[id])
    )
    if (clashing.length === 0) return overrides
    overrides = Object.fromEntries(
      Object.entries(overrides).filter(([id]) => !clashing.includes(id as ShortcutId))
    )
  }
}

/** Overrides after giving a shortcut new keys (its default keys clear the override). */
export function withBinding(
  overrides: KeymapOverrides,
  id: ShortcutId,
  accelerator: string | null
): KeymapOverrides {
  const next = { ...overrides }
  if (accelerator === null || accelerator === KEYMAP[id].accelerator) delete next[id]
  else next[id] = accelerator
  return next
}

// --- Display --------------------------------------------------------------------

// macOS lists modifiers in this order: ⌥⇧⌘, then the key.
const MAC_MODIFIER_ORDER = ['Alt', 'Shift', 'CmdOrCtrl']

const MAC_SYMBOLS: Record<string, string> = {
  CmdOrCtrl: '⌘',
  Shift: '⇧',
  Alt: '⌥',
  Left: '←',
  Right: '→',
  Up: '↑',
  Down: '↓',
  Backspace: '⌫',
  Return: '↩',
  Tab: '⇥',
  Escape: 'Esc',
  Space: 'Space',
  Home: '↖',
  End: '↘',
  PageUp: '⇞',
  PageDown: '⇟',
  '-': '−',
  Scroll: ' + scroll'
}

const OTHER_NAMES: Record<string, string> = {
  CmdOrCtrl: 'Ctrl',
  Left: '←',
  Right: '→',
  Up: '↑',
  Down: '↓',
  Return: 'Enter',
  Escape: 'Esc',
  Scroll: 'Scroll'
}

/** How a shortcut is written for people: "⇧⌘Z" on a Mac, "Ctrl+Shift+Z" elsewhere. */
export function formatKeys(accelerator: string, platform: string): string {
  const { mods, key } = split(accelerator)
  if (platform === 'darwin') {
    const ordered = [...MAC_MODIFIER_ORDER.filter((m) => mods.includes(m)), key]
    return ordered.map((p) => MAC_SYMBOLS[p] ?? p).join('')
  }
  return [...mods, key].map((p) => OTHER_NAMES[p] ?? p).join('+')
}
