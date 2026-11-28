import { contextBridge, ipcRenderer } from 'electron'
import { EXPORT_CHANNELS } from '@shared/exportFormats'
import { LYRICS_CHANNELS } from '@shared/lyrics'
import { APPEARANCE_CHANNELS, Theme, parseTheme } from '@shared/appearance'
import { CATALOG_CHANNELS } from '@shared/catalog'
import {
  FREE_STATUS,
  LICENSE_CHANNELS,
  LicenseStatus,
  parseActivationResult,
  parseLicenseStatus
} from '@shared/license'
import { SETTINGS_CHANNELS } from '@shared/settings'
import { WISHLIST_CHANNELS } from '@shared/wishlist'
import { VOICE_CHANNELS } from '@shared/voice'
import { TASTE_CHANNELS } from '@shared/polishTaste'
import { INPUT_VOLUME_CHANNELS, parseInputVolume } from '@shared/inputVolume'
import { parseOverrides } from '@shared/keymap'
import {
  CONTEXT_MENU_CHANNEL,
  FULL_SCREEN_CHANNEL,
  KEYMAP_CHANNELS,
  MENU_CHANNEL,
  NATIVE_EDIT_CHANNEL,
  CLIPBOARD_TEXT_CHANNEL,
  isMenuAction
} from '@shared/menu'
import type { RoveApi } from './index.d'

// The window reports full screen once when the page loads and then on each change. The
// title bar only listens once a song is open, long after that first report, so the
// latest state is kept here and handed to each new listener; otherwise a window that
// starts full screen keeps the gap for the window buttons it doesn't show.
let fullScreen = false
ipcRenderer.on(FULL_SCREEN_CHANNEL, (_e, full: unknown) => {
  fullScreen = full === true
})

// The chosen theme arrives the same way, once on load and then on each change.
let theme: Theme = 'system'
ipcRenderer.on(APPEARANCE_CHANNELS.changed, (_e, raw: unknown) => {
  theme = parseTheme(raw)
})

// The license arrives the same way, so features show or lock from the first render.
let license: LicenseStatus = FREE_STATUS
ipcRenderer.on(LICENSE_CHANNELS.changed, (_e, raw: unknown) => {
  license = parseLicenseStatus(raw)
})

const api: RoveApi = {
  platform: process.platform,
  onFullScreen: (listener) => {
    listener(fullScreen)
    const handler = (_e: Electron.IpcRendererEvent, full: unknown): void => listener(full === true)
    ipcRenderer.on(FULL_SCREEN_CHANNEL, handler)
    return () => ipcRenderer.removeListener(FULL_SCREEN_CHANNEL, handler)
  },
  onMenu: (listener) => {
    const handler = (_e: Electron.IpcRendererEvent, action: unknown): void => {
      if (isMenuAction(action)) listener(action)
    }
    ipcRenderer.on(MENU_CHANNEL, handler)
    return () => ipcRenderer.removeListener(MENU_CHANNEL, handler)
  },
  getKeymap: () => ipcRenderer.invoke(KEYMAP_CHANNELS.get),
  setKeymap: (overrides) => ipcRenderer.invoke(KEYMAP_CHANNELS.set, overrides),
  onKeymapChanged: (listener) => {
    const handler = (_e: Electron.IpcRendererEvent, raw: unknown): void =>
      listener(parseOverrides(raw))
    ipcRenderer.on(KEYMAP_CHANNELS.changed, handler)
    return () => ipcRenderer.removeListener(KEYMAP_CHANNELS.changed, handler)
  },
  captureShortcutKeys: (on) => ipcRenderer.invoke(KEYMAP_CHANNELS.capture, on),
  showContextMenu: (items) => ipcRenderer.invoke(CONTEXT_MENU_CHANNEL, items),
  nativeEdit: (command) => ipcRenderer.invoke(NATIVE_EDIT_CHANNEL, command),
  readClipboardText: async () => {
    const text: unknown = await ipcRenderer.invoke(CLIPBOARD_TEXT_CHANNEL)
    return typeof text === 'string' ? text : ''
  },
  requestMicAccess: () => ipcRenderer.invoke('mic:requestAccess'),
  openMicSettings: () => ipcRenderer.invoke('mic:openSettings'),
  getInputVolume: async () => parseInputVolume(await ipcRenderer.invoke(INPUT_VOLUME_CHANNELS.get)),
  setInputVolume: async (volume) =>
    parseInputVolume(await ipcRenderer.invoke(INPUT_VOLUME_CHANNELS.set, volume)),
  chooseProjectFolder: () => ipcRenderer.invoke('project:choose'),
  listSongs: () => ipcRenderer.invoke('project:list'),
  openSongbookSong: (folder) => ipcRenderer.invoke('project:openByName', folder),
  updateSongbookSong: (folder, name, artist, note) =>
    ipcRenderer.invoke('project:updateDetails', folder, name, artist, note),
  removeSongbookSong: (folder) => ipcRenderer.invoke('project:trashByName', folder),
  listWishlist: () => ipcRenderer.invoke(WISHLIST_CHANNELS.list),
  addToWishlist: (name, artist, note) =>
    ipcRenderer.invoke(WISHLIST_CHANNELS.add, name, artist, note),
  removeFromWishlist: (id) => ipcRenderer.invoke(WISHLIST_CHANNELS.remove, id),
  updateWishlistItem: (id, name, artist, note) =>
    ipcRenderer.invoke(WISHLIST_CHANNELS.update, id, name, artist, note),
  searchCatalog: (options) => ipcRenderer.invoke(CATALOG_CHANNELS.search, options),
  restoreTabs: () => ipcRenderer.invoke('project:restoreTabs'),
  rememberTabs: (dirs, active) => ipcRenderer.invoke('project:rememberTabs', dirs, active),
  createSong: (name, artist, note) => ipcRenderer.invoke('project:createNew', name, artist, note),
  renameSong: (dir, name) => ipcRenderer.invoke('project:rename', dir, name),
  importBackingTrack: (dir) => ipcRenderer.invoke('project:importBackingTrack', dir),
  saveTake: (dir, wav) => ipcRenderer.invoke('project:saveTake', dir, wav),
  readAudio: (dir, relPath) => ipcRenderer.invoke('project:readAudio', dir, relPath),
  writeManifest: (dir, manifest) => ipcRenderer.invoke('project:writeManifest', dir, manifest),
  exportSongFile: (dir) => ipcRenderer.invoke('project:exportSongFile', dir),
  importSongFile: () => ipcRenderer.invoke('project:importSongFile'),
  chooseExportPath: (name, format) => ipcRenderer.invoke(EXPORT_CHANNELS.choose, name, format),
  writeExport: (filePath, bytes) => ipcRenderer.invoke(EXPORT_CHANNELS.write, filePath, bytes),
  revealExport: (filePath) => ipcRenderer.invoke(EXPORT_CHANNELS.reveal, filePath),
  searchLyrics: (query) => ipcRenderer.invoke(LYRICS_CHANNELS.search, query),
  readSeparationModel: () => ipcRenderer.invoke('separation:model'),
  saveInstrumental: (projectDir, source, wav) =>
    ipcRenderer.invoke('project:saveInstrumental', projectDir, source, wav),
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
  onTheme: (listener) => {
    listener(theme)
    const handler = (_e: Electron.IpcRendererEvent, raw: unknown): void => listener(parseTheme(raw))
    ipcRenderer.on(APPEARANCE_CHANNELS.changed, handler)
    return () => ipcRenderer.removeListener(APPEARANCE_CHANNELS.changed, handler)
  },
  onLicense: (listener) => {
    listener(license)
    const handler = (_e: Electron.IpcRendererEvent, raw: unknown): void =>
      listener(parseLicenseStatus(raw))
    ipcRenderer.on(LICENSE_CHANNELS.changed, handler)
    return () => ipcRenderer.removeListener(LICENSE_CHANNELS.changed, handler)
  },
  activateLicense: async (key) =>
    parseActivationResult(await ipcRenderer.invoke(LICENSE_CHANNELS.activate, key)),
  deactivateLicense: async () =>
    parseLicenseStatus(await ipcRenderer.invoke(LICENSE_CHANNELS.deactivate)),
  openCheckout: async () => (await ipcRenderer.invoke(LICENSE_CHANNELS.openCheckout)) === true,
  openLicenseOrders: () => ipcRenderer.invoke(LICENSE_CHANNELS.openOrders)
}

contextBridge.exposeInMainWorld('api', api)
