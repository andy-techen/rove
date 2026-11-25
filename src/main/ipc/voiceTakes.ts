import { t } from '@shared/copy'
import { vocalClipsOf } from '@shared/voice'
import { resolveAudioPath, songbookFolder } from './fileNames'

/**
 * Where a take the voice profile asked for lives, refusing anything the main process
 * can't vouch for: the folder must be a song directly inside the songs folder, and the
 * file one of that song's vocal clips plays, inside its audio folder. Backing tracks and
 * stray files in the folder are never read this way.
 */
export async function resolveTake(
  songsRoot: string,
  folder: unknown,
  file: unknown,
  readManifest: (dir: string) => Promise<unknown>
): Promise<string> {
  const dir = songbookFolder(songsRoot, folder)
  if (!dir) throw new Error(t('dialogs.songNotOpen'))
  const notTake = new Error(t('dialogs.notAudioFile', { path: String(file) }))
  if (typeof file !== 'string') throw notTake
  const clips = vocalClipsOf(await readManifest(dir))
  if (!clips.some((clip) => clip.file === file)) throw notTake
  return resolveAudioPath(dir, file)
}
