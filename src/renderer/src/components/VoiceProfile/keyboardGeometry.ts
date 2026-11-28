import type { KeyRange } from '../../state/voice/voiceView'

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
