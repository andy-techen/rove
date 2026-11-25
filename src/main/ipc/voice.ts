import { app, ipcMain } from 'electron'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import {
  TakeRef,
  VOICE_CHANNELS,
  VoiceCacheEntry,
  parseVoiceCache,
  vocalClipsOf
} from '@shared/voice'
import { resolveAudioPath } from './fileNames'
import { songsFolder } from './settings'
import { readManifest, songbookDirs } from './songbook'
import { resolveTake } from './voiceTakes'

const cacheFile = (): string => path.join(app.getPath('userData'), 'voice.json')

/** Every vocal clip on every Songbook song whose take is still on disk. */
async function listTakes(): Promise<TakeRef[]> {
  const takes: TakeRef[] = []
  for (const { folder, dir } of await songbookDirs()) {
    let manifest: unknown
    try {
      manifest = await readManifest(dir)
    } catch {
      continue // An unreadable project.json shouldn't hide the other songs.
    }
    const m = manifest as { name?: unknown } | null
    const songName = m && typeof m.name === 'string' && m.name.trim() ? m.name : folder
    for (const clip of vocalClipsOf(manifest)) {
      try {
        // Takes are written once with 'wx' and never changed, so mtime is when it was sung.
        const { mtimeMs } = await fs.stat(resolveAudioPath(dir, clip.file))
        takes.push({ folder, songName, ...clip, recordedAt: mtimeMs })
      } catch {
        // The file is missing, or the path points outside the audio folder.
      }
    }
  }
  return takes
}

async function loadCache(): Promise<VoiceCacheEntry[]> {
  try {
    return parseVoiceCache(JSON.parse(await fs.readFile(cacheFile(), 'utf8')))
  } catch {
    // No file yet, or one we can't read: every take is analysed again.
    return []
  }
}

// Write then rename so a crash mid-write can't leave a half-written cache.
async function saveCache(raw: unknown): Promise<void> {
  const tmp = `${cacheFile()}.tmp`
  await fs.writeFile(tmp, JSON.stringify(parseVoiceCache(raw)))
  await fs.rename(tmp, cacheFile())
}

export function registerVoiceIpc(): void {
  ipcMain.handle(VOICE_CHANNELS.listTakes, listTakes)
  ipcMain.handle(VOICE_CHANNELS.readTake, async (_e, folder: unknown, file: unknown) => {
    const full = await resolveTake(songsFolder(), folder, file, readManifest)
    return new Uint8Array(await fs.readFile(full))
  })
  ipcMain.handle(VOICE_CHANNELS.loadCache, loadCache)
  ipcMain.handle(VOICE_CHANNELS.saveCache, (_e, entries: unknown) => saveCache(entries))
}
