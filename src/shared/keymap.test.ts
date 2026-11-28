import { describe, expect, it } from 'vitest'
import {
  KEYMAP,
  acceleratorFromEvent,
  checkAccelerator,
  effectiveKeymap,
  formatKeys,
  handledInApp,
  matchesAccelerator,
  parseOverrides,
  typesText,
  withBinding
} from './keymap'

const CODES: Record<string, string> = {
  ' ': 'Space',
  ArrowLeft: 'ArrowLeft',
  Delete: 'Delete',
  Shift: 'ShiftLeft',
  '§': 'IntlBackslash'
}

const press = (
  key: string,
  mods: Partial<Record<'metaKey' | 'shiftKey' | 'ctrlKey' | 'altKey', boolean>> = {}
) => ({
  key,
  code: CODES[key] ?? `Key${key.toUpperCase()}`,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  ...mods
})

describe('formatKeys', () => {
  it('writes shortcuts with Mac symbols on macOS', () => {
    expect(formatKeys('CmdOrCtrl+Shift+Z', 'darwin')).toBe('⇧⌘Z')
    expect(formatKeys('CmdOrCtrl+-', 'darwin')).toBe('⌘−')
    expect(formatKeys('Backspace', 'darwin')).toBe('⌫')
    expect(formatKeys('CmdOrCtrl+Left', 'darwin')).toBe('⌘←')
  })

  it('spells them out elsewhere', () => {
    expect(formatKeys('CmdOrCtrl+Shift+Z', 'win32')).toBe('Ctrl+Shift+Z')
  })
})

describe('key presses', () => {
  it('records the physical key with modifiers in a fixed order', () => {
    // ⌥K types "˚" on a Mac; the shortcut is still K.
    expect(acceleratorFromEvent({ ...press('k', { altKey: true, metaKey: true }), key: '˚' })).toBe(
      'CmdOrCtrl+Alt+K'
    )
    expect(acceleratorFromEvent(press('X', { shiftKey: true, metaKey: true }))).toBe(
      'CmdOrCtrl+Shift+X'
    )
  })

  it('ignores a lone modifier or an unsupported key', () => {
    expect(acceleratorFromEvent(press('Shift', { shiftKey: true }))).toBeNull()
    expect(acceleratorFromEvent(press('§'))).toBeNull()
  })

  it('matches single keys only without modifiers', () => {
    expect(matchesAccelerator(press('s'), 'S')).toBe(true)
    expect(matchesAccelerator(press('s', { metaKey: true }), 'S')).toBe(false)
    expect(matchesAccelerator(press('ArrowLeft', { metaKey: true }), 'CmdOrCtrl+Left')).toBe(true)
  })

  it('treats Delete like Backspace and Space by its physical key', () => {
    expect(matchesAccelerator(press('Delete'), 'Backspace')).toBe(true)
    expect(matchesAccelerator(press(' '), 'Space')).toBe(true)
  })
})

describe('who handles a shortcut', () => {
  it('leaves modified keys to the menu and single or text keys to the app', () => {
    expect(handledInApp('save', 'CmdOrCtrl+S')).toBe(false)
    // Through the menu, so text fields keep ⌘A too.
    expect(handledInApp('selectAll', 'CmdOrCtrl+A')).toBe(false)
    expect(handledInApp('save', 'Shift+S')).toBe(true)
    expect(handledInApp('goToStart', 'CmdOrCtrl+Left')).toBe(true)
    // Not in the menu bar, so always the app's.
    expect(handledInApp('deselect', 'CmdOrCtrl+D')).toBe(true)
  })
})

describe('rebinding', () => {
  const keymap = effectiveKeymap({})

  it('refuses keys another shortcut or the system already uses', () => {
    expect(checkAccelerator(keymap, 'split', 'CmdOrCtrl+S')).toEqual({ kind: 'taken', by: 'save' })
    expect(checkAccelerator(keymap, 'split', 'CmdOrCtrl+Q')).toEqual({ kind: 'reserved' })
    expect(checkAccelerator(keymap, 'split', 'CmdOrCtrl+Alt+K')).toBeNull()
  })

  it('clears an override when a shortcut gets its default keys back', () => {
    const changed = withBinding({}, 'split', 'Alt+K')
    expect(changed).toEqual({ split: 'Alt+K' })
    expect(withBinding(changed, 'split', KEYMAP.split.accelerator)).toEqual({})
  })

  it('keeps only stored rebinds that are valid and do not clash', () => {
    const stored = {
      split: 'Alt+K',
      nope: 'Alt+J',
      save: 'Shift+Ctrl+S',
      deleteClip: 'CmdOrCtrl+Q',
      playPause: 'Alt+P',
      zoomFit: 'Alt+P',
      deselect: 'S'
    }
    expect(parseOverrides(stored)).toEqual({ split: 'Alt+K' })
    expect(parseOverrides('junk')).toEqual({})
  })
})

describe('keys that type', () => {
  it('has no default a person could set off by typing', () => {
    for (const id of Object.keys(KEYMAP) as (keyof typeof KEYMAP)[]) {
      expect(typesText(KEYMAP[id].accelerator)).toBe(false)
    }
  })

  it('refuses a letter, number or symbol on its own, or with only ⇧', () => {
    const keymap = effectiveKeymap({})
    for (const keys of ['S', 'Shift+S', '7', '/']) {
      expect(checkAccelerator(keymap, 'split', keys)).toEqual({ kind: 'typing' })
    }
    expect(checkAccelerator(keymap, 'split', 'Alt+S')).toBeNull()
  })
})
