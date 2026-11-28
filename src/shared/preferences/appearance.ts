// The app's colour theme (View ▸ Appearance or the top bar) and text size (Settings).

export const THEMES = ['system', 'light', 'dark'] as const
export type Theme = (typeof THEMES)[number]

export const TEXT_SIZES = ['small', 'medium', 'large'] as const
export type TextSize = (typeof TEXT_SIZES)[number]

export const APPEARANCE_CHANNELS = {
  set: 'appearance:set',
  changed: 'appearance:changed',
  setTextSize: 'appearance:setTextSize',
  textSizeChanged: 'appearance:textSizeChanged'
} as const

/** The theme one click on the top bar's button moves to. */
export const nextTheme = (theme: Theme): Theme =>
  THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]

/** A stored or sent theme, falling back to following the system. */
export const parseTheme = (raw: unknown): Theme =>
  (THEMES as readonly unknown[]).includes(raw) ? (raw as Theme) : 'system'

/** A stored or sent text size, falling back to medium. */
export const parseTextSize = (raw: unknown): TextSize =>
  (TEXT_SIZES as readonly unknown[]).includes(raw) ? (raw as TextSize) : 'medium'
