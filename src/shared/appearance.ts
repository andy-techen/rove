// The app's colour theme, chosen in View ▸ Appearance or from the top bar.

export const THEMES = ['system', 'light', 'dark'] as const
export type Theme = (typeof THEMES)[number]

export const APPEARANCE_CHANNELS = { set: 'appearance:set', changed: 'appearance:changed' } as const

/** The theme one click on the top bar's button moves to. */
export const nextTheme = (theme: Theme): Theme =>
  THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]

/** A stored or sent theme, falling back to following the system. */
export const parseTheme = (raw: unknown): Theme =>
  (THEMES as readonly unknown[]).includes(raw) ? (raw as Theme) : 'system'
