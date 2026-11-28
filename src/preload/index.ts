import { contextBridge, ipcRenderer } from 'electron'
import { EXPORT_CHANNELS } from '@shared/exportFormats'
import { LYRICS_CHANNELS } from '@shared/online/lyrics'
import { APPEARANCE_CHANNELS, Theme, parseTheme } from '@shared/preferences/appearance'
import { CATALOG_CHANNELS } from '@shared/online/catalog'
import {
  FREE_STATUS,
  LICENSE_CHANNELS,
  LicenseStatus,
  parseActivationResult,
  parseLicenseStatus
} from '@shared/license/license'
import { SETTINGS_CHANNELS } from '@shared/preferences/settings'
import { WISHLIST_CHANNELS } from '@shared/preferences/wishlist'
import { VOICE_CHANNELS } from '@shared/songs/voice'
import { TASTE_CHANNELS } from '@shared/preferences/polishTaste'
import { INPUT_VOLUME_CHANNELS, parseInputVolume } from '@shared/preferences/inputVolume'
import { parseOverrides } from '@shared/preferences/keymap'
import { MIC_CHANNELS } from '@shared/songs/mic'
import { PROJECT_CHANNELS } from '@shared/songs/project'
import { SEPARATION_MODEL_CHANNEL } from '@shared/songs/separation'
import {
  CONTEXT_MENU_CHANNEL,
  FULL_SCREEN_CHANNEL,
  KEYMAP_CHANNELS,
  MENU_CHANNEL,
  NATIVE_EDIT_CHANNEL,
  CLIPBOARD_TEXT_CHANNEL,
  isMenuAction
} from '@shared/preferences/menu'
import type { RoveApi } from './index.d'

type Subscribe<T> = (listener: (value: T) => void) => () => void

/**
 * Listens on a channel the main process sends to, parsing each message. With `cached`, the
 * latest value is kept from the moment the page loads and handed to each new listener
 * first: the main process reports some state once on load, long before anything listens.
 */
function subscribe<T>(channel: string, parse: (raw: unknown) => T, cached?: T): Subscribe<T> {
  let latest = cached
  if (cached !== undefined) {
    ipcRenderer.on(channel, (_e, raw: unknown) => {
      latest = parse(raw)
    })
  }
  return (listener) => {
    if (latest !== undefined) listener(latest)
    const handler = (_e: Electron.IpcRendererEvent, raw: unknown): void => listener(parse(raw))
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  }
}

// The title bar only listens once a song is open; without the cached state, a window that
// starts full screen keeps the gap for the window buttons it doesn't show.
const onFullScreen = subscribe(FULL_SCREEN_CHANNEL, (full) => full === true, false)
const onTheme = subscribe<Theme>(APPEARANCE_CHANNELS.changed, parseTheme, 'system')
// Cached so features show or lock from the first render.
const onLicense = subscribe<LicenseStatus>(
  LICENSE_CHANNELS.changed,
  parseLicenseStatus,
  FREE_STATUS
)

const api: RoveApi = {
  platform: process.platform,
  onFullScreen,
  onMenu: (listener) => {
    const handler = (_e: Electron.IpcRendererEvent, action: unknown): void => {
      if (isMenuAction(action)) listener(action)
    }
    ipcRenderer.on(MENU_CHANNEL, handler)
    return () => ipcRenderer.removeListener(MENU_CHANNEL, handler)
  },
  getKeymap: () => ipcRenderer.invoke(KEYMAP_CHANNELS.get),
  setKeymap: (overrides) => ipcRenderer.invoke(KEYMAP_CHANNELS.set, overrides),
  onKeymapChanged: subscribe(KEYMAP_CHANNELS.changed, parseOverrides),
  captureShortcutKeys: (on) => ipcRenderer.invoke(KEYMAP_CHANNELS.capture, on),
  showContextMenu: (items) => ipcRenderer.invoke(CONTEXT_MENU_CHANNEL, items),
  nativeEdit: (command) => ipcRenderer.invoke(NATIVE_EDIT_CHANNEL, command),
  readClipboardText: async () => {
    const text: unknown = await ipcRenderer.invoke(CLIPBOARD_TEXT_CHANNEL)
    return typeof text === 'string' ? text : ''
  },
  requestMicAccess: () => ipcRenderer.invoke(MIC_CHANNELS.requestAccess),
  openMicSettings: () => ipcRenderer.invoke(MIC_CHANNELS.openSettings),
  getInputVolume: async () => parseInputVolume(await ipcRenderer.invoke(INPUT_VOLUME_CHANNELS.get)),
  setInputVolume: async (volume) =>
    parseInputVolume(await ipcRenderer.invoke(INPUT_VOLUME_CHANNELS.set, volume)),
  chooseProjectFolder: () => ipcRenderer.invoke(PROJECT_CHANNELS.choose),
  listSongs: () => ipcRenderer.invoke(PROJECT_CHANNELS.list),
  openSongbookSong: (folder) => ipcRenderer.invoke(PROJECT_CHANNELS.openByName, folder),
  updateSongbookSong: (folder, name, artist, note) =>
    ipcRenderer.invoke(PROJECT_CHANNELS.updateDetails, folder, name, artist, note),
  removeSongbookSong: (folder) => ipcRenderer.invoke(PROJECT_CHANNELS.trashByName, folder),
  listWishlist: () => ipcRenderer.invoke(WISHLIST_CHANNELS.list),
  addToWishlist: (name, artist, note) =>
    ipcRenderer.invoke(WISHLIST_CHANNELS.add, name, artist, note),
  removeFromWishlist: (id) => ipcRenderer.invoke(WISHLIST_CHANNELS.remove, id),
  updateWishlistItem: (id, name, artist, note) =>
    ipcRenderer.invoke(WISHLIST_CHANNELS.update, id, name, artist, note),
  searchCatalog: (options) => ipcRenderer.invoke(CATALOG_CHANNELS.search, options),
  restoreTabs: () => ipcRenderer.invoke(PROJECT_CHANNELS.restoreTabs),
  rememberTabs: (dirs, active) => ipcRenderer.invoke(PROJECT_CHANNELS.rememberTabs, dirs, active),
  createSong: (name, artist, note) =>
    ipcRenderer.invoke(PROJECT_CHANNELS.createNew, name, artist, note),
  renameSong: (dir, name) => ipcRenderer.invoke(PROJECT_CHANNELS.rename, dir, name),
  importBackingTrack: (dir) => ipcRenderer.invoke(PROJECT_CHANNELS.importBackingTrack, dir),
  saveTake: (dir, wav) => ipcRenderer.invoke(PROJECT_CHANNELS.saveTake, dir, wav),
  readAudio: (dir, relPath) => ipcRenderer.invoke(PROJECT_CHANNELS.readAudio, dir, relPath),
  writeManifest: (dir, manifest) =>
    ipcRenderer.invoke(PROJECT_CHANNELS.writeManifest, dir, manifest),
  exportSongFile: (dir) => ipcRenderer.invoke(PROJECT_CHANNELS.exportSongFile, dir),
  importSongFile: () => ipcRenderer.invoke(PROJECT_CHANNELS.importSongFile),
  chooseExportPath: (name, format) => ipcRenderer.invoke(EXPORT_CHANNELS.choose, name, format),
  writeExport: (filePath, bytes) => ipcRenderer.invoke(EXPORT_CHANNELS.write, filePath, bytes),
  revealExport: (filePath) => ipcRenderer.invoke(EXPORT_CHANNELS.reveal, filePath),
  shareExport: (filePath) => ipcRenderer.invoke(EXPORT_CHANNELS.share, filePath),
  searchLyrics: (query) => ipcRenderer.invoke(LYRICS_CHANNELS.search, query),
  readSeparationModel: () => ipcRenderer.invoke(SEPARATION_MODEL_CHANNEL),
  saveInstrumental: (projectDir, source, wav) =>
    ipcRenderer.invoke(PROJECT_CHANNELS.saveInstrumental, projectDir, source, wav),
  voice: {
    listTakes: () => ipcRenderer.invoke(VOICE_CHANNELS.listTakes),
    readTake: (folder, file) => ipcRenderer.invoke(VOICE_CHANNELS.readTake, folder, file),
    loadCache: () => ipcRenderer.invoke(VOICE_CHANNELS.loadCache),
    saveCache: (entries) => ipcRenderer.invoke(VOICE_CHANNELS.saveCache, entries)
  },
  taste: {
    listExamples: () => ipcRenderer.invoke(TASTE_CHANNELS.listExamples)
  },
  getSongsFolder: () => ipcRenderer.invoke(SETTINGS_CHANNELS.songsFolder),
  chooseSongsFolder: () => ipcRenderer.invoke(SETTINGS_CHANNELS.chooseSongsFolder),
  setTheme: (next) => ipcRenderer.invoke(APPEARANCE_CHANNELS.set, next),
  onTheme,
  onLicense,
  activateLicense: async (key) =>
    parseActivationResult(await ipcRenderer.invoke(LICENSE_CHANNELS.activate, key)),
  deactivateLicense: async () =>
    parseLicenseStatus(await ipcRenderer.invoke(LICENSE_CHANNELS.deactivate)),
  openCheckout: async () => (await ipcRenderer.invoke(LICENSE_CHANNELS.openCheckout)) === true,
  openLicenseOrders: () => ipcRenderer.invoke(LICENSE_CHANNELS.openOrders)
}

contextBridge.exposeInMainWorld('api', api)
