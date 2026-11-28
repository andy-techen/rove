import { randomUUID } from 'node:crypto'
import { access, mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { t } from '@shared/copy'
import { nextUntitledName, songFolderName, uniqueFolderName } from './fileNames'
import { MANIFEST, readManifest } from './songbook'
import { ZipSource, readZip, writeZip } from './zip'

// A song file (.rove) is a zip of a song folder: project.json plus every audio file its
// clips play, so a song can move to another Mac or to a friend who has Rove.

export const SONG_FILE_EXTENSION = 'rove'
const AUDIO_DIR = 'audio'
// A project.json is a few hundred kilobytes at most; anything far bigger isn't one.
const MAX_MANIFEST_BYTES = 10 * 1024 * 1024

/**
 * Whether a name inside a song file is one Rove writes: project.json, or a file directly
 * inside audio/. Everything else (parent references, absolute paths, subfolders, hidden
 * files) could land outside the new song folder, so it's refused.
 */
export function archiveEntryOk(name: string): boolean {
  if (name === MANIFEST) return true
  const [dir, file, ...rest] = name.split('/')
  return (
    dir === AUDIO_DIR &&
    rest.length === 0 &&
    !!file &&
    !file.startsWith('.') &&
    !/[\\:\0]/.test(file)
  )
}

/**
 * Every audio file a project plays, as paths inside the song folder: each clip's file, the
 * song an instrumental was made from (`withVocals`, so vocals can go back). Paths that reach
 * outside audio/ are left out.
 */
export function archiveFilesOf(manifest: unknown): string[] {
  const m = manifest as { tracks?: unknown } | null
  if (!m || !Array.isArray(m.tracks)) return []
  const files = new Set<string>()
  const add = (file: unknown): void => {
    if (typeof file === 'string' && file !== MANIFEST && archiveEntryOk(file)) files.add(file)
  }
  for (const track of m.tracks as unknown[]) {
    const clips = (track as { clips?: unknown } | null)?.clips
    if (!Array.isArray(clips)) continue
    for (const clip of clips as unknown[]) {
      const c = clip as { file?: unknown; withVocals?: unknown } | null
      add(c?.file)
      add(c?.withVocals)
    }
  }
  return [...files]
}

const exists = (file: string): Promise<boolean> =>
  access(file).then(
    () => true,
    () => false
  )

/** Writes a song folder to a song file. A clip whose file is gone is left out. */
export async function packSong(songDir: string, target: string): Promise<void> {
  const manifest = await readManifest(songDir)
  if (!manifest) throw new Error(t('songFile.notASong'))
  const entries: ZipSource[] = [{ name: MANIFEST, source: path.join(songDir, MANIFEST) }]
  for (const file of archiveFilesOf(manifest)) {
    const source = path.join(songDir, file)
    if (await exists(source)) entries.push({ name: file, source })
  }
  await writeZip(target, entries)
}

/**
 * Unpacks a song file into a new folder under the songs folder and returns it. Only
 * the project and the audio it plays come out; an archive naming anything outside the
 * song folder is refused whole. The folder is filled under a hidden name and renamed
 * once complete, so a failed import leaves no half-song in the Songbook, and it never
 * takes the name of an existing song.
 */
export async function unpackSong(archive: string, songsRoot: string): Promise<string> {
  const zip = await readZip(archive)
  const staging = path.join(songsRoot, `.rove-import-${randomUUID()}`)
  try {
    const notSong = new Error(t('songFile.notASong'))
    if (!zip.entries.every((entry) => archiveEntryOk(entry.name))) throw notSong
    const manifestEntry = zip.entries.find((entry) => entry.name === MANIFEST)
    if (!manifestEntry || manifestEntry.size > MAX_MANIFEST_BYTES) throw notSong
    const manifestBytes = await zip.read(manifestEntry)
    let manifest: unknown
    try {
      manifest = JSON.parse(manifestBytes.toString('utf8'))
    } catch {
      throw notSong
    }
    const m = manifest as { name?: unknown; tracks?: unknown } | null
    if (!m || typeof m.name !== 'string' || !Array.isArray(m.tracks)) throw notSong

    const wanted = new Set(archiveFilesOf(manifest))
    await mkdir(songsRoot, { recursive: true })
    await mkdir(path.join(staging, AUDIO_DIR), { recursive: true })
    for (const entry of zip.entries) {
      if (!wanted.has(entry.name)) continue
      wanted.delete(entry.name)
      await writeFile(path.join(staging, entry.name), await zip.read(entry), { flag: 'wx' })
    }
    // Last, so the folder only looks like a song once its audio is in place.
    await writeFile(path.join(staging, MANIFEST), manifestBytes, { flag: 'wx' })

    const existing = (await readdir(songsRoot)).filter((name) => !name.startsWith('.rove-import-'))
    const folder = songFolderName(m.name)
    const target = path.join(
      songsRoot,
      folder ? uniqueFolderName(existing, folder) : nextUntitledName(existing)
    )
    await rename(staging, target)
    return target
  } catch (error) {
    // Only the hidden folder this import made; nothing of the singer's is touched.
    await rm(staging, { recursive: true, force: true })
    throw error
  } finally {
    await zip.close()
  }
}
