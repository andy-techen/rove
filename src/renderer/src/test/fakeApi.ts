import { vi } from 'vitest'
import { KeymapOverrides, parseOverrides } from '@shared/keymap'
import type { MenuAction } from '@shared/menu'
import type { LyricsResult } from '@shared/lyrics'
import type { Theme } from '@shared/appearance'
import type { RoveApi } from '../../../preload/index.d'

/** A stand-in for the preload bridge: every call is a spy, menu events can be fired. */
export function createFakeApi(): RoveApi & { fireMenu(action: MenuAction): void } {
  const menuListeners = new Set<(action: MenuAction) => void>()
  return {
    platform: 'darwin',
    onFullScreen: () => () => {},
    nativeEdit: vi.fn(async () => {}),
    showContextMenu: vi.fn(async () => {}),
    onMenu: (listener) => {
      menuListeners.add(listener)
      return () => menuListeners.delete(listener)
    },
    fireMenu: (action) => menuListeners.forEach((listener) => listener(action)),
    getKeymap: vi.fn(async () => ({})),
    setKeymap: vi.fn(async (overrides: KeymapOverrides) => parseOverrides(overrides)),
    onKeymapChanged: () => () => {},
    captureShortcutKeys: vi.fn(async () => {}),
    requestMicAccess: vi.fn(async () => true),
    openMicSettings: vi.fn(async () => {}),
    chooseProjectFolder: vi.fn(async () => null),
    restoreTabs: vi.fn(async () => ({ songs: [], activeSong: null })),
    rememberTabs: vi.fn(async () => {}),
    createSong: vi.fn(async () => ({
      dir: '/songs/Untitled Song',
      name: 'Untitled Song',
      manifest: null
    })),
    renameSong: vi.fn(async (_dir: string, name: string) => `/songs/${name}`),
    importBackingTrack: vi.fn(async () => null),
    saveTake: vi.fn(async () => 'audio/take-001.wav'),
    readAudio: vi.fn(async () => new Uint8Array()),
    writeManifest: vi.fn(async () => {}),
    chooseExportPath: vi.fn(async (name: string, format: string) => `/Music/${name}.${format}`),
    writeExport: vi.fn(async () => {}),
    revealExport: vi.fn(async () => {}),
    searchLyrics: vi.fn(async (): Promise<LyricsResult[]> => []),
    setTheme: vi.fn(async (theme: Theme) => theme),
    readSeparationModel: vi.fn(async () => new Uint8Array()),
    saveInstrumental: vi.fn(async () => 'audio/song (no vocals).wav'),
    getSongsFolder: vi.fn(async () => '/Users/singer/Music/Rove'),
    chooseSongsFolder: vi.fn(async (): Promise<string | null> => null),
    onTheme: vi.fn((listener: (theme: Theme) => void) => {
      listener('system')
      return () => {}
    })
  }
}
