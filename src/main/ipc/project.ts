import { app, BrowserWindow, dialog, ipcMain, IpcMainInvokeEvent, shell } from 'electron'
import { SONG_NAME_MAX_LENGTH } from '@shared/constants'
import { t } from '@shared/copy'
import { cleanNote } from '@shared/wishlist'
import fs from 'node:fs/promises'
import path from 'node:path'
import {
  instrumentalName,
  nextTakeName,
  nextUntitledName,
  resolveAudioPath,
  songFolderName,
  uniqueFolderName,
  uniqueName
} from './fileNames'
import { songsFolder } from './settings'
import { MANIFEST, readManifest, songbookDirs, songbookSong } from './songbook'

const BACKING_EXTENSIONS = ['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg']

// The renderer may only touch song folders the main process opened for it:
// ones the user picked, ones Rove created, or ones it remembered from last time.
const openProjects = new Set<string>()

const stateFile = (): string => path.join(app.getPath('userData'), 'state.json')
const songsRoot = songsFolder

interface SavedTabs {
  openSongs: string[]
  activeSong: string | null
}

async function saveTabs(tabs: SavedTabs): Promise<void> {
  await fs.writeFile(stateFile(), JSON.stringify(tabs))
}

/** The songs that were open last time, skipping any that were moved or deleted. */
async function recallTabs(): Promise<SavedTabs> {
  try {
    const saved = JSON.parse(await fs.readFile(stateFile(), 'utf8'))
    // Earlier versions remembered a single song.
    const dirs: unknown[] = Array.isArray(saved.openSongs)
      ? saved.openSongs
      : saved.lastSongDir
        ? [saved.lastSongDir]
        : []
    const openSongs: string[] = []
    for (const dir of dirs) {
      if (typeof dir !== 'string') continue
      try {
        await fs.access(path.join(dir, MANIFEST))
        openSongs.push(dir)
      } catch {
        // Gone since last time; leave it out.
      }
    }
    const active = typeof saved.activeSong === 'string' ? saved.activeSong : null
    return { openSongs, activeSong: active && openSongs.includes(active) ? active : null }
  } catch {
    return { openSongs: [], activeSong: null }
  }
}

async function openSong(dir: string): Promise<{ dir: string; name: string; manifest: unknown }> {
  openProjects.add(dir)
  const manifest = await readManifest(dir)
  return { dir, name: path.basename(dir), manifest }
}

function assertOpen(projectDir: string): void {
  if (!openProjects.has(projectDir)) throw new Error(t('dialogs.songNotOpen'))
}

function windowFor(e: IpcMainInvokeEvent): BrowserWindow | undefined {
  return BrowserWindow.fromWebContents(e.sender) ?? undefined
}

async function audioDirFiles(projectDir: string): Promise<string[]> {
  const audioDir = path.join(projectDir, 'audio')
  await fs.mkdir(audioDir, { recursive: true })
  return fs.readdir(audioDir)
}

// Folders Rove created under the songs folder follow the song name. Folders the user
// picked elsewhere are theirs to organize, so only the name in project.json changes.
async function followName(projectDir: string, songName: string): Promise<string> {
  const folder = songFolderName(songName)
  if (!folder) throw new Error(t('dialogs.songNameNeeded'))
  if (path.dirname(projectDir) !== songsRoot() || path.basename(projectDir) === folder) {
    return projectDir
  }
  const siblings = (await fs.readdir(songsRoot())).filter((n) => n !== path.basename(projectDir))
  const target = path.join(songsRoot(), uniqueFolderName(siblings, folder))
  await fs.rename(projectDir, target)
  if (openProjects.delete(projectDir)) openProjects.add(target)
  return target
}

// Write then rename so a crash mid-write can't leave a half-written project file.
async function writeManifestFile(projectDir: string, manifest: unknown): Promise<void> {
  const target = path.join(projectDir, MANIFEST)
  const tmp = `${target}.tmp`
  await fs.writeFile(tmp, JSON.stringify(manifest, null, 2))
  await fs.rename(tmp, target)
}

const cleanText = (raw: unknown): string =>
  typeof raw === 'string' ? raw.trim().slice(0, SONG_NAME_MAX_LENGTH) : ''

export function registerProjectIpc(): void {
  ipcMain.handle('project:choose', async (e) => {
    const options = {
      title: t('dialogs.openSongTitle'),
      buttonLabel: t('dialogs.openSongButton'),
      defaultPath: songsRoot(),
      properties: ['openDirectory', 'createDirectory'] as Array<'openDirectory' | 'createDirectory'>
    }
    const win = windowFor(e)
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled || !result.filePaths[0]) return null
    return openSong(result.filePaths[0])
  })

  // Lists every song under the songs folder for the Songbook. Folders without a
  // project.json are skipped: the user's other folders aren't Rove songs.
  ipcMain.handle('project:list', async () => {
    const songs: {
      folder: string
      name: string
      artist?: string
      note?: string
      modifiedAt: number
    }[] = []
    for (const { folder, dir } of await songbookDirs()) {
      try {
        const [manifest, stat] = await Promise.all([
          readManifest(dir),
          fs.stat(path.join(dir, MANIFEST))
        ])
        const m = manifest as { name?: unknown; artist?: unknown; note?: unknown } | null
        const name = m && typeof m.name === 'string' && m.name.trim() ? m.name : folder
        const artist = m && typeof m.artist === 'string' && m.artist.trim() ? m.artist : undefined
        const note = cleanNote(m?.note)
        songs.push({
          folder,
          name,
          ...(artist && { artist }),
          ...(note && { note }),
          modifiedAt: stat.mtimeMs
        })
      } catch {
        // Not a Rove song (no project.json) or unreadable; skip it.
      }
    }
    songs.sort((a, b) => b.modifiedAt - a.modifiedAt)
    return songs
  })

  // Opens a song by its folder name under the songs folder. The renderer can't pass
  // an arbitrary path: anything with a separator, parent reference or that resolves
  // outside the songs folder is refused.
  ipcMain.handle('project:openByName', async (_e, folder: unknown) => {
    const dir = await songbookSong(folder)
    return openSong(dir)
  })

  // The singer asked to remove the whole song, so it goes to the Trash, where they can
  // still get it back; Rove itself never deletes recordings. The Songbook keeps songs
  // open in a tab out of reach (openProjects also holds songs whose tabs have closed).
  ipcMain.handle('project:trashByName', async (_e, folder: unknown) => {
    const dir = await songbookSong(folder)
    await shell.trashItem(dir)
    openProjects.delete(dir)
  })

  // Changes a closed song's name, artist and note from the Songbook; its folder follows
  // the name.
  ipcMain.handle(
    'project:updateDetails',
    async (_e, folder: unknown, name: unknown, artist: unknown, note: unknown) => {
      const dir = await songbookSong(folder)
      const songName = cleanText(name)
      if (!songFolderName(songName)) throw new Error(t('dialogs.songNameNeeded'))
      const manifest = await readManifest(dir)
      if (!manifest || typeof manifest !== 'object') throw new Error(t('dialogs.songNotOpen'))
      const next: Record<string, unknown> = { ...manifest, name: songName }
      const artistName = cleanText(artist)
      if (artistName) next.artist = artistName
      else delete next.artist
      const songNote = cleanNote(note)
      if (songNote) next.note = songNote
      else delete next.note
      await writeManifestFile(dir, next)
      const moved = await followName(dir, songName)
      const { mtimeMs } = await fs.stat(path.join(moved, MANIFEST))
      return {
        folder: path.basename(moved),
        name: songName,
        ...(artistName && { artist: artistName }),
        ...(songNote && { note: songNote }),
        modifiedAt: mtimeMs
      }
    }
  )

  ipcMain.handle('project:restoreTabs', async () => {
    const { openSongs, activeSong } = await recallTabs()
    const songs: Awaited<ReturnType<typeof openSong>>[] = []
    for (const dir of openSongs) {
      try {
        songs.push(await openSong(dir))
      } catch {
        // An unreadable project.json shouldn't stop the other tabs from opening.
      }
    }
    return { songs, activeSong }
  })

  // Only folders this session already opened can be remembered, so a renderer
  // can't plant an arbitrary path to be trusted on the next launch.
  ipcMain.handle('project:rememberTabs', async (_e, dirs: string[], active: string | null) => {
    const openSongs = dirs.filter((d) => openProjects.has(d))
    await saveTabs({ openSongs, activeSong: active && openSongs.includes(active) ? active : null })
  })

  // A named song gets a folder after its name; an unnamed one (the first launch) is untitled.
  ipcMain.handle('project:createNew', async (_e, name: unknown, artist: unknown, note: unknown) => {
    const wanted = typeof name === 'string' ? name.trim().slice(0, SONG_NAME_MAX_LENGTH) : ''
    const artistName =
      typeof artist === 'string' ? artist.trim().slice(0, SONG_NAME_MAX_LENGTH) : ''
    await fs.mkdir(songsRoot(), { recursive: true })
    const existing = await fs.readdir(songsRoot())
    const folder = songFolderName(wanted)
    const dir = path.join(
      songsRoot(),
      folder ? uniqueFolderName(existing, folder) : nextUntitledName(existing)
    )
    await fs.mkdir(dir)
    const opened = await openSong(dir)
    const named = folder ? { ...opened, name: wanted } : opened
    const songNote = cleanNote(note)
    return {
      ...named,
      ...(artistName && { artist: artistName }),
      ...(songNote && { note: songNote })
    }
  })

  ipcMain.handle('project:rename', async (_e, projectDir: string, songName: string) => {
    assertOpen(projectDir)
    return followName(projectDir, songName)
  })

  // Copies the chosen file into the project so the song folder is self-contained
  // and the user's original file is never touched.
  ipcMain.handle('project:importBackingTrack', async (e, projectDir: string) => {
    assertOpen(projectDir)
    const options = {
      title: t('dialogs.backingTitle'),
      buttonLabel: t('dialogs.backingButton'),
      properties: ['openFile'] as Array<'openFile'>,
      filters: [{ name: t('dialogs.audioFiles'), extensions: BACKING_EXTENSIONS }]
    }
    const win = windowFor(e)
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)
    const source = result.filePaths[0]
    if (result.canceled || !source) return null
    const name = path.basename(source)
    const fileName = uniqueName(await audioDirFiles(projectDir), `backing-${name}`)
    await fs.copyFile(source, path.join(projectDir, 'audio', fileName), fs.constants.COPYFILE_EXCL)
    return { file: `audio/${fileName}`, name }
  })

  ipcMain.handle('project:saveTake', async (_e, projectDir: string, data: ArrayBuffer) => {
    assertOpen(projectDir)
    const fileName = nextTakeName(await audioDirFiles(projectDir))
    // 'wx' refuses to overwrite: an existing recording is never replaced.
    await fs.writeFile(path.join(projectDir, 'audio', fileName), Buffer.from(data), { flag: 'wx' })
    return `audio/${fileName}`
  })

  // An instrumental made by removing the vocals: a new file beside its song, which stays.
  ipcMain.handle(
    'project:saveInstrumental',
    async (_e, projectDir: string, source: string, data: ArrayBuffer) => {
      assertOpen(projectDir)
      resolveAudioPath(projectDir, source)
      const fileName = instrumentalName(await audioDirFiles(projectDir), source)
      await fs.writeFile(path.join(projectDir, 'audio', fileName), Buffer.from(data), {
        flag: 'wx'
      })
      return `audio/${fileName}`
    }
  )

  ipcMain.handle('project:readAudio', async (_e, projectDir: string, relPath: string) => {
    assertOpen(projectDir)
    return new Uint8Array(await fs.readFile(resolveAudioPath(projectDir, relPath)))
  })

  ipcMain.handle('project:writeManifest', async (_e, projectDir: string, manifest: unknown) => {
    assertOpen(projectDir)
    await writeManifestFile(projectDir, manifest)
  })
}
