import type { TextSize } from '@shared/preferences/appearance'
import type { Settings } from '@shared/preferences/settings'

// Settings
export const DEFAULTS: Settings = {
  songsFolder: null,
  exportsFolder: null
}

// Text size
// The whole page zooms, not just the type, so text never outgrows the controls around it.
export const TEXT_SIZE_ZOOM: Record<TextSize, number> = {
  small: 0.9,
  medium: 1,
  large: 1.2
}
