// App settings kept in userData/settings.json, chosen in Rove ▸ Settings.

export interface Settings {
  /** Where new songs are created; null means the default, ~/Music/Rove. */
  songsFolder: string | null
  /** Where the save dialog for an export first opens; null means ~/Music. */
  exportsFolder: string | null
}

export const SETTINGS_CHANNELS = {
  songsFolder: 'settings:songsFolder',
  chooseSongsFolder: 'settings:chooseSongsFolder',
  exportsFolder: 'settings:exportsFolder',
  chooseExportsFolder: 'settings:chooseExportsFolder'
} as const

// An absolute path on macOS/Linux ("/…") or Windows ("C:\…").
const ABSOLUTE_PATH = /^(\/|[A-Za-z]:[\\/])/

const folderOf = (raw: unknown): string | null =>
  typeof raw === 'string' && ABSOLUTE_PATH.test(raw) ? raw : null

/** Stored settings, keeping only values that make sense. */
export function parseSettings(raw: unknown): Settings {
  const r = raw as Partial<Record<keyof Settings, unknown>> | null
  return {
    songsFolder: folderOf(r?.songsFolder),
    exportsFolder: folderOf(r?.exportsFolder)
  }
}
