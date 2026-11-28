import { t } from '@shared/copy'
import { cleanNote } from '@shared/preferences/wishlist'
import type { SongbookEntry } from '@shared/songs/project'
import fs from 'node:fs/promises'
import path from 'node:path'
import { songbookFolder } from '../files/fileNames'
import { songsFolder } from '../preferences/settings'

export const MANIFEST = 'project.json'

/** A song's project.json, or null when the folder has none. */
export async function readManifest(projectDir: string): Promise<unknown> {
  try {
    return JSON.parse(await fs.readFile(path.join(projectDir, MANIFEST), 'utf8'))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw err
  }
}

export interface SongbookDir {
  /** The folder's name under the songs folder. */
  folder: string
  dir: string
}

/**
 * Every folder directly inside the songs folder. Callers read each project.json and skip
 * folders without one: the user's other folders aren't Rove songs.
 */
export async function songbookDirs(): Promise<SongbookDir[]> {
  const root = songsFolder()
  try {
    const entries = await fs.readdir(root, { withFileTypes: true })
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => ({ folder: entry.name, dir: path.join(root, entry.name) }))
  } catch {
    return []
  }
}

/** A Rove song inside the songs folder, named by the Songbook; anything else is refused. */
export async function songbookSong(folder: unknown): Promise<string> {
  const dir = songbookFolder(songsFolder(), folder)
  if (!dir) throw new Error(t('dialogs.songNotOpen'))
  await fs.access(path.join(dir, MANIFEST))
  return dir
}

/**
 * Every Rove song under the songs folder, newest first: for the Songbook and the Dock
 * menu. Folders without a project.json are skipped: the user's other folders aren't
 * Rove songs.
 */
export async function listSongbook(): Promise<SongbookEntry[]> {
  const songs: SongbookEntry[] = []
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
}
