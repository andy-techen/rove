import { t } from '@shared/copy'
import { ShortcutId, formatKeys } from '@shared/keymap'
import { useKeymap } from './keymap'

interface Shortcuts {
  /** Any keys as this platform writes them. */
  format(accelerator: string): string
  /** A shortcut's keys as this platform writes them ("⇧⌘Z" on a Mac). */
  keys(id: ShortcutId): string
  /** A tooltip that names the action and its shortcut: "Undo (⌘Z)". */
  label(label: string, id: ShortcutId): string
}

/** Shortcut text that follows the person's keymap. */
export function useShortcuts(): Shortcuts {
  const { keymap } = useKeymap()
  const format = (accelerator: string): string => formatKeys(accelerator, window.api.platform)
  const keys = (id: ShortcutId): string => format(keymap[id])
  return { format, keys, label: (label, id) => t('shortcut', { label, keys: keys(id) }) }
}
