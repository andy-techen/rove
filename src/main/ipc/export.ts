import { app, BrowserWindow, dialog, ipcMain, shell, ShareMenu } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { t } from '@shared/copy'
import { EXPORT_CHANNELS, EXPORT_FORMATS, ExportFormat } from '@shared/exportFormats'
import { songFolderName } from './fileNames'

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
    const win = BrowserWindow.fromWebContents(e.sender)
    const fileName = `${songFolderName(songName) || t('dialogs.untitledSong')}.${format}`
    const options = {
      title: t('export.dialogTitle'),
      defaultPath: path.join(lastDir ?? app.getPath('music'), fileName),
      filters: [{ name: t(`export.formats.${format}`), extensions: [format] }]
    }
    const result = win
      ? await dialog.showSaveDialog(win, options)
      : await dialog.showSaveDialog(options)
    if (result.canceled || !result.filePath) return null
    chosen.add(result.filePath)
    lastDir = path.dirname(result.filePath)
    return result.filePath
  })

  ipcMain.handle(EXPORT_CHANNELS.write, async (_e, filePath: unknown, bytes: unknown) => {
    if (typeof filePath !== 'string' || !chosen.has(filePath) || !(bytes instanceof Uint8Array)) {
      throw new Error(t('export.failed'))
    }
    chosen.delete(filePath)
    // Written beside the target and renamed, so a failed export never leaves half a file.
    const tmp = `${filePath}.rove-partial`
    await fs.writeFile(tmp, bytes)
    await fs.rename(tmp, filePath)
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
    const win = BrowserWindow.fromWebContents(e.sender) ?? undefined
    new ShareMenu({ filePaths: [filePath] }).popup({ window: win })
  })
}
