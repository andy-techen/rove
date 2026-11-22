import type { ExportFormat } from '../shared/exportFormats'
import type { KeymapOverrides } from '../shared/keymap'
import type { LyricsResult } from '../shared/lyrics'
import type { Theme } from '../shared/appearance'
import type { MenuAction, NativeEdit } from '../shared/menu'

export interface ChosenProject {
  dir: string
  name: string
  manifest: unknown
}

export interface ImportedBackingTrack {
  file: string
  name: string
}

export interface RoveApi {
  /** Node's platform name ('darwin' on macOS), for platform-specific layout. */
  platform: string
  /** Listens for the window entering or leaving full screen; returns an unsubscribe. */
  onFullScreen(listener: (fullScreen: boolean) => void): () => void
  /** Runs a text-editing command (undo, cut, paste…) on the focused field. */
  nativeEdit(command: NativeEdit): Promise<void>
  /** Listens for native menu choices; returns a function that stops listening. */
  onMenu(listener: (action: MenuAction) => void): () => void
  /** The shortcuts the person has rebound (the rest keep their defaults). */
  getKeymap(): Promise<KeymapOverrides>
  /** Saves rebinds and rebuilds the menu; resolves to what was kept after validation. */
  setKeymap(overrides: KeymapOverrides): Promise<KeymapOverrides>
  onKeymapChanged(listener: (overrides: KeymapOverrides) => void): () => void
  /** Stops menu shortcuts firing while the person presses keys to rebind one. */
  captureShortcutKeys(on: boolean): Promise<void>
  requestMicAccess(): Promise<boolean>
  openMicSettings(): Promise<void>
  chooseProjectFolder(): Promise<ChosenProject | null>
  /** Reopens the songs that were open last time. */
  restoreTabs(): Promise<{ songs: ChosenProject[]; activeSong: string | null }>
  rememberTabs(dirs: string[], active: string | null): Promise<void>
  /** Makes a song folder under ~/Music/Rove, named after the song (untitled without a name). */
  createSong(name?: string): Promise<ChosenProject>
  /** Resolves to the song's folder, which moves when Rove manages it. */
  renameSong(projectDir: string, name: string): Promise<string>
  importBackingTrack(projectDir: string): Promise<ImportedBackingTrack | null>
  saveTake(projectDir: string, wav: ArrayBuffer): Promise<string>
  readAudio(projectDir: string, relPath: string): Promise<Uint8Array>
  writeManifest(projectDir: string, manifest: unknown): Promise<void>
  /** Asks where to save an export; null if the person cancels. */
  chooseExportPath(songName: string, format: ExportFormat): Promise<string | null>
  /** Writes an export to the path just chosen (and only that path). */
  writeExport(filePath: string, bytes: Uint8Array): Promise<void>
  revealExport(filePath: string): Promise<void>
  /** Looks up lyrics online by song and artist; throws when the service can't be reached. */
  searchLyrics(query: string): Promise<LyricsResult[]>
  /** Switches the app (and its native menus and dialogs) to a theme, remembered for next time. */
  setTheme(theme: Theme): Promise<Theme>
  /** Listens for the chosen theme (now, then on each change); returns an unsubscribe. */
  onTheme(listener: (theme: Theme) => void): () => void
}

declare global {
  interface Window {
    api: RoveApi
  }
}
