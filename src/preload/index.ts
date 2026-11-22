import { contextBridge, ipcRenderer } from 'electron'
import { EXPORT_CHANNELS } from '@shared/exportFormats'
import { LYRICS_CHANNELS } from '@shared/lyrics'
import { APPEARANCE_CHANNELS, Theme, parseTheme } from '@shared/appearance'
import { parseOverrides } from '@shared/keymap'
import {
  FULL_SCREEN_CHANNEL,
  KEYMAP_CHANNELS,
  MENU_CHANNEL,
  NATIVE_EDIT_CHANNEL,
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
  nativeEdit: (command) => ipcRenderer.invoke(NATIVE_EDIT_CHANNEL, command),
  requestMicAccess: () => ipcRenderer.invoke('mic:requestAccess'),
  openMicSettings: () => ipcRenderer.invoke('mic:openSettings'),
  chooseProjectFolder: () => ipcRenderer.invoke('project:choose'),
  restoreTabs: () => ipcRenderer.invoke('project:restoreTabs'),
  rememberTabs: (dirs, active) => ipcRenderer.invoke('project:rememberTabs', dirs, active),
  createSong: (name) => ipcRenderer.invoke('project:createNew', name),
  renameSong: (dir, name) => ipcRenderer.invoke('project:rename', dir, name),
  importBackingTrack: (dir) => ipcRenderer.invoke('project:importBackingTrack', dir),
  saveTake: (dir, wav) => ipcRenderer.invoke('project:saveTake', dir, wav),
  readAudio: (dir, relPath) => ipcRenderer.invoke('project:readAudio', dir, relPath),
  writeManifest: (dir, manifest) => ipcRenderer.invoke('project:writeManifest', dir, manifest),
  chooseExportPath: (name, format) => ipcRenderer.invoke(EXPORT_CHANNELS.choose, name, format),
  writeExport: (filePath, bytes) => ipcRenderer.invoke(EXPORT_CHANNELS.write, filePath, bytes),
  revealExport: (filePath) => ipcRenderer.invoke(EXPORT_CHANNELS.reveal, filePath),
  searchLyrics: (query) => ipcRenderer.invoke(LYRICS_CHANNELS.search, query),
  setTheme: (next) => ipcRenderer.invoke(APPEARANCE_CHANNELS.set, next),
  onTheme: (listener) => {
    listener(theme)
    const handler = (_e: Electron.IpcRendererEvent, raw: unknown): void => listener(parseTheme(raw))
    ipcRenderer.on(APPEARANCE_CHANNELS.changed, handler)
    return () => ipcRenderer.removeListener(APPEARANCE_CHANNELS.changed, handler)
  }
}

contextBridge.exposeInMainWorld('api', api)
