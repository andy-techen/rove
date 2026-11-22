import { BrowserWindow, dialog, ipcMain, IpcMainInvokeEvent } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { nextTakeName, resolveAudioPath, uniqueName } from './fileNames'

const MANIFEST = 'project.json'
const BACKING_EXTENSIONS = ['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg']

// The renderer may only touch folders the user picked in a dialog this session.
const openProjects = new Set<string>()

function assertOpen(projectDir: string): void {
  if (!openProjects.has(projectDir)) throw new Error('That song folder is not open.')
}

function windowFor(e: IpcMainInvokeEvent): BrowserWindow | undefined {
  return BrowserWindow.fromWebContents(e.sender) ?? undefined
}

async function audioDirFiles(projectDir: string): Promise<string[]> {
  const audioDir = path.join(projectDir, 'audio')
  await fs.mkdir(audioDir, { recursive: true })
  return fs.readdir(audioDir)
}

async function readManifest(projectDir: string): Promise<unknown> {
  try {
    return JSON.parse(await fs.readFile(path.join(projectDir, MANIFEST), 'utf8'))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw err
  }
}

export function registerProjectIpc(): void {
  ipcMain.handle('project:choose', async (e) => {
    const options = {
      title: 'Choose a folder for your song',
      buttonLabel: 'Use this folder',
      properties: ['openDirectory', 'createDirectory'] as Array<'openDirectory' | 'createDirectory'>
    }
    const win = windowFor(e)
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled || !result.filePaths[0]) return null
    const dir = result.filePaths[0]
    openProjects.add(dir)
    return { dir, name: path.basename(dir), manifest: await readManifest(dir) }
  })

  // Copies the chosen file into the project so the song folder is self-contained
  // and the user's original file is never touched.
  ipcMain.handle('project:importBackingTrack', async (e, projectDir: string) => {
    assertOpen(projectDir)
    const options = {
      title: 'Choose a backing track',
      buttonLabel: 'Add backing track',
      properties: ['openFile'] as Array<'openFile'>,
      filters: [{ name: 'Audio', extensions: BACKING_EXTENSIONS }]
    }
    const win = windowFor(e)
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)
    const source = result.filePaths[0]
    if (result.canceled || !source) return null
    const name = path.basename(source)
    const fileName = uniqueName(await audioDirFiles(projectDir), `backing-${name}`)
    await fs.copyFile(source, path.join(projectDir, 'audio', fileName), fs.constants.COPYFILE_EXCL)
    return { file: `audio/${fileName}`, name }
  })

  ipcMain.handle('project:saveTake', async (_e, projectDir: string, data: ArrayBuffer) => {
    assertOpen(projectDir)
    const fileName = nextTakeName(await audioDirFiles(projectDir))
    // 'wx' refuses to overwrite: an existing recording is never replaced.
    await fs.writeFile(path.join(projectDir, 'audio', fileName), Buffer.from(data), { flag: 'wx' })
    return `audio/${fileName}`
  })

  ipcMain.handle('project:readAudio', async (_e, projectDir: string, relPath: string) => {
    assertOpen(projectDir)
    return new Uint8Array(await fs.readFile(resolveAudioPath(projectDir, relPath)))
  })

  ipcMain.handle('project:writeManifest', async (_e, projectDir: string, manifest: unknown) => {
    assertOpen(projectDir)
    // Write then rename so a crash mid-write can't leave a half-written project file.
    const target = path.join(projectDir, MANIFEST)
    const tmp = `${target}.tmp`
    await fs.writeFile(tmp, JSON.stringify(manifest, null, 2))
    await fs.rename(tmp, target)
  })
}
