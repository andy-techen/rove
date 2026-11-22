import { contextBridge, ipcRenderer } from 'electron'
import type { RoveApi } from './index.d'

const api: RoveApi = {
  requestMicAccess: () => ipcRenderer.invoke('mic:requestAccess'),
  openMicSettings: () => ipcRenderer.invoke('mic:openSettings')
}

contextBridge.exposeInMainWorld('api', api)
