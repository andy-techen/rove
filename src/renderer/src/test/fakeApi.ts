import { vi } from 'vitest'
import { KeymapOverrides, parseOverrides } from '@shared/keymap'
import type { MenuAction } from '@shared/menu'
import type { LyricsResult } from '@shared/lyrics'
import type { Theme } from '@shared/appearance'
import type { TasteExample } from '@shared/polishTaste'
import { FREE_STATUS, LicenseStatus } from '@shared/license'
import type { ChosenProject } from '@shared/project'
import type { RoveApi } from '../../../preload/index.d'

/** A stand-in for the preload bridge: every call is a spy, menu events can be fired. */
export function createFakeApi(): RoveApi & { fireMenu(action: MenuAction): void } {
  const menuListeners = new Set<(action: MenuAction) => void>()
  return {
    platform: 'darwin',
    onFullScreen: () => () => {},
    nativeEdit: vi.fn(async () => {}),
    readClipboardText: vi.fn(async () => ''),
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
    getInputVolume: vi.fn(async () => null),
    setInputVolume: vi.fn(async () => null),
    chooseProjectFolder: vi.fn(async () => null),
    listSongs: vi.fn(async () => []),
    openSongbookSong: vi.fn(async (folder: string) => ({
      dir: `/songs/${folder}`,
      name: folder,
      manifest: null
    })),
    updateSongbookSong: vi.fn(async (_folder: string, name: string, artist?: string) => ({
      folder: name,
      name,
      ...(artist && { artist }),
      modifiedAt: 0
    })),
    removeSongbookSong: vi.fn(async () => {}),
    listWishlist: vi.fn(async () => []),
    addToWishlist: vi.fn(async () => []),
    removeFromWishlist: vi.fn(async () => []),
    updateWishlistItem: vi.fn(async () => []),
    searchCatalog: vi.fn(async () => ({ items: [], total: 0 })),
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
    exportSongFile: vi.fn(async (): Promise<string | null> => null),
    importSongFile: vi.fn(async (): Promise<ChosenProject | null> => null),
    chooseExportPath: vi.fn(async (name: string, format: string) => `/Music/${name}.${format}`),
    writeExport: vi.fn(async () => {}),
    revealExport: vi.fn(async () => {}),
    shareExport: vi.fn(async () => {}),
    searchLyrics: vi.fn(async (): Promise<LyricsResult[]> => []),
    setTheme: vi.fn(async (theme: Theme) => theme),
    readSeparationModel: vi.fn(async () => new Uint8Array()),
    saveInstrumental: vi.fn(async () => 'audio/song (no vocals).wav'),
    voice: {
      listTakes: vi.fn(async () => []),
      readTake: vi.fn(async () => new Uint8Array()),
      loadCache: vi.fn(async () => []),
      saveCache: vi.fn(async () => {})
    },
    taste: {
      listExamples: vi.fn(async (): Promise<TasteExample[]> => [])
    },
    getSongsFolder: vi.fn(async () => '/Users/singer/Music/Rove'),
    chooseSongsFolder: vi.fn(async (): Promise<string | null> => null),
    onTheme: vi.fn((listener: (theme: Theme) => void) => {
      listener('system')
      return () => {}
    }),
    onLicense: vi.fn((listener: (status: LicenseStatus) => void) => {
      listener(FREE_STATUS)
      return () => {}
    }),
    activateLicense: vi.fn(async (key: string) => ({
      ok: true as const,
      status: { plan: 'premium' as const, keyHint: `•••• ${key.slice(-4)}` }
    })),
    deactivateLicense: vi.fn(async () => FREE_STATUS),
    openCheckout: vi.fn(async () => false),
    openLicenseOrders: vi.fn(async () => {})
  }
}
