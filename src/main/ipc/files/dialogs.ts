import { BrowserWindow, dialog, IpcMainInvokeEvent } from 'electron'

/** The window that sent a request, so its dialogs attach to it as sheets. */
export function windowFor(e: IpcMainInvokeEvent): BrowserWindow | undefined {
  return BrowserWindow.fromWebContents(e.sender) ?? undefined
}

/** Asks for a file or folder; resolves to the first one picked, or null if cancelled. */
export async function showOpen(
  e: IpcMainInvokeEvent,
  options: Electron.OpenDialogOptions
): Promise<string | null> {
  const win = windowFor(e)
  const result = win
    ? await dialog.showOpenDialog(win, options)
    : await dialog.showOpenDialog(options)
  return (!result.canceled && result.filePaths[0]) || null
}

/** Asks where to save; resolves to the path, or null if cancelled. */
export async function showSave(
  e: IpcMainInvokeEvent,
  options: Electron.SaveDialogOptions
): Promise<string | null> {
  const win = windowFor(e)
  const result = win
    ? await dialog.showSaveDialog(win, options)
    : await dialog.showSaveDialog(options)
  return (!result.canceled && result.filePath) || null
}
