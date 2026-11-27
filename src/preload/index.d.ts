import type { CatalogSearchOptions, CatalogSearchResult } from '../shared/catalog'
import type { ExportFormat } from '../shared/exportFormats'
import type { KeymapOverrides } from '../shared/keymap'
import type { LyricsResult } from '../shared/lyrics'
import type { Theme } from '../shared/appearance'
import type { ActivationResult, LicenseStatus } from '../shared/license'
import type { WishlistItem } from '../shared/wishlist'
import type { VoiceApi } from '../shared/voice'
import type { ContextMenuItem, MenuAction, NativeEdit } from '../shared/menu'

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
  /** The system clipboard's text (empty when it holds none). */
  readClipboardText(): Promise<string>
  /** Shows a right-click menu; the choice arrives through `onMenu`. */
  showContextMenu(items: ContextMenuItem[]): Promise<void>
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
  /** The Mac's input volume (0–100), or null when the current input has none Rove can set. */
  getInputVolume(): Promise<number | null>
  /** Sets the Mac's input volume; resolves to the volume it now has. */
  setInputVolume(volume: number): Promise<number | null>
  chooseProjectFolder(): Promise<ChosenProject | null>
  /** Every Rove song under the songs folder, newest first, for the Songbook. */
  listSongs(): Promise<SongbookEntry[]>
  /** Opens a song by its folder name under the songs folder. */
  openSongbookSong(folder: string): Promise<ChosenProject>
  /** Changes a closed song's name and artist; resolves to its entry, folder renamed to match. */
  updateSongbookSong(
    folder: string,
    name: string,
    artist?: string,
    note?: string
  ): Promise<SongbookEntry>
  /** Moves a song folder to the Trash. The Songbook only offers this for closed songs. */
  removeSongbookSong(folder: string): Promise<void>
  /** Songs to try later, newest first. Add and remove resolve to the updated list. */
  listWishlist(): Promise<WishlistItem[]>
  addToWishlist(name: string, artist?: string, note?: string): Promise<WishlistItem[]>
  removeFromWishlist(id: string): Promise<WishlistItem[]>
  /** Changes a wishlist song's name, artist and note; a missing artist or note removes it. */
  updateWishlistItem(
    id: string,
    name: string,
    artist?: string,
    note?: string
  ): Promise<WishlistItem[]>
  /** Searches the curated song catalog that ships with the app. */
  searchCatalog(options: CatalogSearchOptions): Promise<CatalogSearchResult>
  /** Reopens the songs that were open last time. */
  restoreTabs(): Promise<{ songs: ChosenProject[]; activeSong: string | null }>
  rememberTabs(dirs: string[], active: string | null): Promise<void>
  /** Makes a song folder under ~/Music/Rove, named after the song (untitled without a name). */
  createSong(name?: string, artist?: string, note?: string): Promise<ChosenProject>
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
  /** The bundled vocal removal model's bytes. */
  readSeparationModel(): Promise<Uint8Array>
  /** Saves an instrumental beside the song it came from; resolves to its project path. */
  saveInstrumental(projectDir: string, source: string, wav: ArrayBuffer): Promise<string>
  /** The singer's takes across every Songbook song, and the voice profile's saved summaries. */
  voice: VoiceApi
  /** Where new songs are created. */
  getSongsFolder(): Promise<string>
  /** Asks for a new songs folder; resolves to it, or null if cancelled. */
  chooseSongsFolder(): Promise<string | null>
  /** Listens for the chosen theme (now, then on each change); returns an unsubscribe. */
  onTheme(listener: (theme: Theme) => void): () => void
  /** Listens for this Mac's plan and key hint (now, then on each change). */
  onLicense(listener: (status: LicenseStatus) => void): () => void
  /** Activates a license key on this Mac; premium turns on if it's accepted. */
  activateLicense(key: string): Promise<ActivationResult>
  /** Frees this Mac's activation and goes back to free. */
  deactivateLicense(): Promise<LicenseStatus>
  /** Opens checkout in the browser; false while there's nowhere to buy yet. */
  openCheckout(): Promise<boolean>
  /** Opens the page where buyers find their orders and keys. */
  openLicenseOrders(): Promise<void>
}

declare global {
  interface Window {
    api: RoveApi
  }
}
