import { t } from '@shared/copy'
import { showSnack } from '../ui/snackbar'

/**
 * Writes the open song as one .rove project file, after saving the latest edits so the
 * file holds what's on screen.
 */
export async function exportSongFile(song: {
  dir: string
  saveNow(): Promise<void>
}): Promise<void> {
  try {
    await song.saveNow()
    if (await window.api.exportSongFile(song.dir)) showSnack(t('songFile.exported'))
  } catch {
    showSnack(t('songFile.exportFailed'))
  }
}
