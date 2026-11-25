import type { KeyRange } from '../../state/voice/voiceView'

export const KEYBOARD_HEIGHT = 40

// Room below a chart's bottom labels for letters that hang under the line (the p in
// Sharp); without it the scrolling section clips them.
export const LABEL_DESCENT = 4

/** Where notes sit across a chart drawn at its real width, one unit to a pixel. */
export interface KeyScale {
  keys: KeyRange
  keyWidth: number
  x(note: number): number
}

export function keyScale(keys: KeyRange, width: number): KeyScale {
  const keyWidth = width / (keys.high - keys.low + 1)
  return { keys, keyWidth, x: (note) => (note - keys.low) * keyWidth }
}
