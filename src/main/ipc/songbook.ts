import { t } from '@shared/copy'
import fs from 'node:fs/promises'
import path from 'node:path'
import { songbookFolder } from './fileNames'
import { songsFolder } from './settings'

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
