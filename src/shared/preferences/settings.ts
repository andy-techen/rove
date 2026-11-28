// App settings kept in userData/settings.json, chosen in Rove ▸ Settings.

export interface Settings {
  /** Where new songs are created; null means the default, ~/Music/Rove. */
  songsFolder: string | null
}

export const SETTINGS_CHANNELS = {
  songsFolder: 'settings:songsFolder',
  chooseSongsFolder: 'settings:chooseSongsFolder'
} as const

// An absolute path on macOS/Linux ("/…") or Windows ("C:\…").
const ABSOLUTE_PATH = /^(\/|[A-Za-z]:[\\/])/

/** Stored settings, keeping only values that make sense. */
export function parseSettings(raw: unknown): Settings {
  const folder = (raw as Partial<Settings> | null)?.songsFolder
  return {
    songsFolder: typeof folder === 'string' && ABSOLUTE_PATH.test(folder) ? folder : null
  }
}
