import { app, ipcMain, shell, ShareMenu } from 'electron'
import path from 'node:path'
import { t } from '@shared/copy'
import { EXPORT_CHANNELS, EXPORT_FORMATS, ExportFormat } from '@shared/exportFormats'
import { showSave, windowFor } from '../files/dialogs'
import { songFolderName } from '../files/fileNames'
import { writeAtomically } from '../files/writeAtomically'

// The renderer may write only to a path the person just picked in the save dialog,
// once, and reveal only files it exported.
const chosen = new Set<string>()
const written = new Set<string>()
// Next export opens where the last one went.
let lastDir: string | null = null

const isFormat = (value: unknown): value is ExportFormat =>
  (EXPORT_FORMATS as readonly unknown[]).includes(value)

export function registerExportIpc(): void {
  ipcMain.handle(EXPORT_CHANNELS.choose, async (e, songName: unknown, format: unknown) => {
    if (typeof songName !== 'string' || !isFormat(format)) throw new Error(t('export.failed'))
    const fileName = `${songFolderName(songName) || t('dialogs.untitledSong')}.${format}`
    const filePath = await showSave(e, {
      title: t('export.dialogTitle'),
      defaultPath: path.join(lastDir ?? app.getPath('music'), fileName),
      filters: [{ name: t(`export.formats.${format}`), extensions: [format] }]
    })
    if (!filePath) return null
    chosen.add(filePath)
    lastDir = path.dirname(filePath)
    return filePath
  })

  ipcMain.handle(EXPORT_CHANNELS.write, async (_e, filePath: unknown, bytes: unknown) => {
    if (typeof filePath !== 'string' || !chosen.has(filePath) || !(bytes instanceof Uint8Array)) {
      throw new Error(t('export.failed'))
    }
    chosen.delete(filePath)
    // A failed export never leaves half a file.
    await writeAtomically(filePath, bytes)
    written.add(filePath)
  })

  ipcMain.handle(EXPORT_CHANNELS.reveal, (_e, filePath: unknown) => {
    if (typeof filePath === 'string' && written.has(filePath)) shell.showItemInFolder(filePath)
  })

  // The Mac's share menu: AirDrop to the singer's phone, Messages, Mail, Photos and the
  // rest, at the pointer. Only for a file this export wrote.
  ipcMain.handle(EXPORT_CHANNELS.share, (e, filePath: unknown) => {
    if (typeof filePath !== 'string' || !written.has(filePath)) return
    if (process.platform !== 'darwin') {
      shell.showItemInFolder(filePath)
      return
    }
    new ShareMenu({ filePaths: [filePath] }).popup({ window: windowFor(e) })
  })
}
