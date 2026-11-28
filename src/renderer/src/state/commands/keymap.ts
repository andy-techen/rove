import { useSyncExternalStore } from 'react'
import { Keymap, KeymapOverrides, effectiveKeymap } from '@shared/preferences/keymap'

interface KeymapState {
  keymap: Keymap
  overrides: KeymapOverrides
}

// One copy for the whole window: key handling reads it at key-press time, and
// components subscribe so tooltips and Help update the moment a shortcut changes.
let state: KeymapState = { keymap: effectiveKeymap({}), overrides: {} }
const listeners = new Set<() => void>()

export function applyOverrides(overrides: KeymapOverrides): void {
  state = { keymap: effectiveKeymap(overrides), overrides }
  listeners.forEach((listener) => listener())
}

/** Loads the person's shortcuts and follows changes made in any window. */
export function syncKeymap(): () => void {
  void window.api.getKeymap().then(applyOverrides)
  return window.api.onKeymapChanged(applyOverrides)
}

export async function saveOverrides(overrides: KeymapOverrides): Promise<void> {
  applyOverrides(await window.api.setKeymap(overrides))
}

export const currentKeymap = (): Keymap => state.keymap

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useKeymap(): KeymapState {
  return useSyncExternalStore(subscribe, () => state)
}
