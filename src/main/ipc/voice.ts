import { ipcMain } from 'electron'
import { promises as fs } from 'node:fs'
import { TakeRef, VOICE_CHANNELS, parseVoiceCache, vocalClipsOf } from '@shared/voice'
import { resolveAudioPath } from './fileNames'
import { songsFolder } from './settings'
import { readManifest, songbookDirs } from './songbook'
import { resolveTake } from './voiceTakes'
import { jsonStore } from './jsonStore'

// With no file, or one we can't read, every take is analysed again. It holds a summary per
// take, so it's kept compact.
const cache = jsonStore('voice.json', parseVoiceCache, [], { compact: true })

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

export function registerVoiceIpc(): void {
  ipcMain.handle(VOICE_CHANNELS.listTakes, listTakes)
  ipcMain.handle(VOICE_CHANNELS.readTake, async (_e, folder: unknown, file: unknown) => {
    const full = await resolveTake(songsFolder(), folder, file, readManifest)
    return new Uint8Array(await fs.readFile(full))
  })
  ipcMain.handle(VOICE_CHANNELS.loadCache, () => cache.load())
  ipcMain.handle(VOICE_CHANNELS.saveCache, (_e, entries: unknown) =>
    cache.save(parseVoiceCache(entries))
  )
}
