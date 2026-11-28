// Opening, listing and saving songs: the IPC both sides share.

export const PROJECT_CHANNELS = {
  choose: 'project:choose',
  list: 'project:list',
  openByName: 'project:openByName',
  trashByName: 'project:trashByName',
  updateDetails: 'project:updateDetails',
  restoreTabs: 'project:restoreTabs',
  rememberTabs: 'project:rememberTabs',
  createNew: 'project:createNew',
  rename: 'project:rename',
  importBackingTrack: 'project:importBackingTrack',
  saveTake: 'project:saveTake',
  saveInstrumental: 'project:saveInstrumental',
  readAudio: 'project:readAudio',
  exportSongFile: 'project:exportSongFile',
  importSongFile: 'project:importSongFile',
  writeManifest: 'project:writeManifest'
} as const

export interface ChosenProject {
  dir: string
  name: string
  manifest: unknown
  /** Set only when the user named a artist as they created the song. */
  artist?: string
  /** Set only when a new song carries a note over from the wishlist. */
  note?: string
}

export interface SongbookEntry {
  folder: string
  name: string
  artist?: string
  /** The singer's own reminder: what to practise, the key, who it's for. */
  note?: string
  modifiedAt: number
}
