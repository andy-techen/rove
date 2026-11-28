import { useEffect } from 'react'
import {
  SHORTCUT_IDS,
  ShortcutId,
  handledInApp,
  matchesAccelerator,
  yieldsToControls
} from '@shared/preferences/keymap'
import { MenuAction, NATIVE_EDITS, NativeEdit } from '@shared/preferences/menu'
import { keyboardFocus } from '../ui/focusRing'
import { currentKeymap } from './keymap'

/** Anything the person can ask for from the menu bar or the keyboard. */
export type Command = MenuAction | ShortcutId

const listeners = new Set<(command: Command) => void>()

// One shared menu subscription for the whole app: ipcRenderer caps listeners at 10
// by default, and each open tab wires up two (RecordScreen and Timeline), so a few
// tabs would otherwise fire a MaxListenersExceededWarning. Fanning out from a single
// listener keeps the count flat.
let stopMenu: (() => void) | null = null

function dispatch(command: Command): void {
  for (const listener of listeners) listener(command)
}

/**
 * Listens for commands, whether they came from the menu bar or a key the renderer
 * handles itself. Returns a function that stops listening.
 */
export function onCommand(listener: (command: Command) => void): () => void {
  listeners.add(listener)
  if (!stopMenu) stopMenu = window.api.onMenu(dispatch)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && stopMenu) {
      stopMenu()
      stopMenu = null
    }
  }
}

/** Is the keyboard focus in a text field, where keys and undo belong to the text? */
export const typingIn = (target: EventTarget | null): boolean =>
  target instanceof Element &&
  !!target.closest('input:not([type=range]):not([type=checkbox]), textarea, select')

/** Is focus on any form control, including sliders (whose arrow keys move them)? */
const onControl = (target: EventTarget | null): boolean =>
  target instanceof Element && !!target.closest('input, textarea, select')

const ACTIVATES_CONTROLS = new Set(['Space'])

/**
 * Was this control reached with the keyboard? Then Space presses it, as everywhere
 * else. One just clicked keeps focus too, but there Space means play: nobody expects
 * Space to press the mute button they clicked a minute ago.
 */
const keyboardFocused = (target: EventTarget | null): boolean =>
  target instanceof Element &&
  target !== document.body &&
  !!target.closest('button, [role=button], input, select, summary, a[href]') &&
  keyboardFocus(target)

/** The shortcut a key press triggers, if the renderer (not the menu) owns those keys. */
export function shortcutForKey(e: KeyboardEvent): ShortcutId | null {
  const keymap = currentKeymap()
  const id = SHORTCUT_IDS.find(
    (s) => handledInApp(s, keymap[s]) && matchesAccelerator(e, keymap[s])
  )
  if (!id) return null
  // Arrow shortcuts give way to any focused control, Space to one reached with Tab,
  // and the rest only to text fields.
  const blocked =
    (yieldsToControls(keymap[id]) ? onControl(e.target) : typingIn(e.target)) ||
    (ACTIVATES_CONTROLS.has(keymap[id]) && keyboardFocused(e.target))
  return blocked ? null : id
}

/** Turns the window's key presses into commands. Mount once, at the top of the app. */
export function useShortcutKeys(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.repeat || e.defaultPrevented) return
      const id = shortcutForKey(e)
      if (!id) return
      e.preventDefault()
      dispatch(id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

const isNativeEdit = (command: Command): command is NativeEdit =>
  (NATIVE_EDITS as readonly string[]).includes(command)

/**
 * Lets undo, cut, copy, paste and select all act on a focused text field. The Edit menu
 * sends them to the renderer, so without this, typing anywhere a song doesn't handle
 * them (the Songbook, Settings, Welcome) couldn't be copied. Mount once, at the top.
 */
export function useTextEdits(): void {
  useEffect(
    () =>
      onCommand((command) => {
        if (isNativeEdit(command) && typingIn(document.activeElement)) {
          void window.api.nativeEdit(command)
        }
      }),
    []
  )
}

/** Is this an editing command the focused text field should handle instead? */
export const editsText = (command: Command): boolean =>
  isNativeEdit(command) && typingIn(document.activeElement)
