// Keys that move focus around: the only ones that should bring the focus ring back.
const NAVIGATION_KEYS = new Set([
  'Tab',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'PageUp',
  'PageDown'
])

/**
 * Marks how the singer last moved around, on `<html data-input>`, so the focus ring
 * shows for keyboard navigation only. Chromium's own `:focus-visible` also lights up a
 * clicked button as soon as any key is pressed, which on the beat pad (played with the
 * keys) and after shortcuts (Space to play) rings whatever was clicked last.
 * Returns a function that stops tracking.
 */
export function trackFocusRing(): () => void {
  const root = document.documentElement
  const onPointer = (): void => {
    root.dataset.input = 'pointer'
  }
  const onKey = (e: KeyboardEvent): void => {
    if (NAVIGATION_KEYS.has(e.key)) root.dataset.input = 'keyboard'
  }
  window.addEventListener('pointerdown', onPointer, true)
  window.addEventListener('keydown', onKey, true)
  return () => {
    window.removeEventListener('pointerdown', onPointer, true)
    window.removeEventListener('keydown', onKey, true)
  }
}

/**
 * Was `el` reached with the keyboard? `:focus-visible`, except after a click, when only
 * keyboard navigation counts (see `trackFocusRing`).
 */
export const keyboardFocus = (el: Element): boolean =>
  el.matches(':focus-visible') && document.documentElement.dataset.input !== 'pointer'
