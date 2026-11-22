import { contextBridge, ipcRenderer } from 'electron'
import type { RoveApi } from './index.d'

const api: RoveApi = {
  requestMicAccess: () => ipcRenderer.invoke('mic:requestAccess'),
  openMicSettings: () => ipcRenderer.invoke('mic:openSettings'),
  chooseProjectFolder: () => ipcRenderer.invoke('project:choose'),
  importBackingTrack: (dir) => ipcRenderer.invoke('project:importBackingTrack', dir),
  saveTake: (dir, wav) => ipcRenderer.invoke('project:saveTake', dir, wav),
  readAudio: (dir, relPath) => ipcRenderer.invoke('project:readAudio', dir, relPath),
  writeManifest: (dir, manifest) => ipcRenderer.invoke('project:writeManifest', dir, manifest)
}

contextBridge.exposeInMainWorld('api', api)
