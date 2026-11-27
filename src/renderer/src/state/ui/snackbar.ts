import { useSyncExternalStore } from 'react'

/** A one-off message: something worked, and the singer needn't do anything about it. */
export interface Snack {
  id: number
  text: string
}

let current: Snack | null = null
let nextId = 1
const listeners = new Set<() => void>()
const changed = (): void => listeners.forEach((listener) => listener())

/** Shows a message briefly at the bottom of the window; a newer one replaces it. */
export function showSnack(text: string): void {
  current = { id: nextId++, text }
  changed()
}

/** Hides this message, unless a newer one has already taken its place. */
export function dismissSnack(id: number): void {
  if (current?.id !== id) return
  current = null
  changed()
}

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const useSnack = (): Snack | null => useSyncExternalStore(subscribe, () => current)
