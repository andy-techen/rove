import path from 'node:path'
import { SONG_NAME_MAX_LENGTH } from '@shared/constants'
import { t } from '@shared/copy'

export function nextTakeName(existing: string[]): string {
  let max = 0
  for (const name of existing) {
    const match = /^take-(\d+)\.wav$/.exec(name)
    if (match) max = Math.max(max, Number(match[1]))
  }
  return `take-${String(max + 1).padStart(3, '0')}.wav`
}

// Compared case-insensitively because the default macOS file system is.
export function uniqueFolderName(existing: string[], desired: string): string {
  const taken = new Set(existing.map((n) => n.toLowerCase()))
  if (!taken.has(desired.toLowerCase())) return desired
  for (let i = 2; ; i++) {
    const candidate = `${desired} ${i}`
    if (!taken.has(candidate.toLowerCase())) return candidate
  }
}

export function nextUntitledName(existing: string[]): string {
  return uniqueFolderName(existing, t('dialogs.untitledSong'))
}

// Song names are free text; folder names can't contain path separators, and a
// leading dot would hide the folder in Finder.
export function songFolderName(songName: string): string {
  return Array.from(songName)
    .filter((ch) => ch >= ' ')
    .join('')
    .replace(/[/\\:]/g, '-')
    .trim()
    .replace(/^\.+/, '')
    .slice(0, SONG_NAME_MAX_LENGTH)
    .trim()
}

/** The file an instrumental is saved as: its song's name, marked, never an existing name. */
export function instrumentalName(existing: string[], source: string): string {
  return uniqueName(existing, `${path.parse(source).name} (no vocals).wav`)
}

export function uniqueName(existing: string[], desired: string): string {
  if (!existing.includes(desired)) return desired
  const { name, ext } = path.parse(desired)
  for (let i = 2; ; i++) {
    const candidate = `${name}-${i}${ext}`
    if (!existing.includes(candidate)) return candidate
  }
}

// Audio paths come from the renderer and the project file, so they must
// resolve to a file directly inside the project's audio folder.
export function resolveAudioPath(projectDir: string, relPath: string): string {
  const audioDir = path.resolve(projectDir, 'audio')
  const full = path.resolve(projectDir, relPath)
  if (path.dirname(full) !== audioDir) throw new Error(t('dialogs.notAudioFile', { path: relPath }))
  return full
}

/**
 * A song folder named by the Songbook, as a path directly inside the songs folder, or
 * null for anything that could reach elsewhere (separators, "." or "..").
 */
export function songbookFolder(songsRoot: string, folder: unknown): string | null {
  if (typeof folder !== 'string' || !folder || folder === '.' || folder === '..') return null
  if (folder.includes('/') || folder.includes('\\')) return null
  const dir = path.join(songsRoot, folder)
  return path.dirname(dir) === songsRoot ? dir : null
}
