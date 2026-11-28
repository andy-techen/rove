import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { ipcMain } from 'electron'
import { INPUT_VOLUME_CHANNELS, parseInputVolume } from '@shared/preferences/inputVolume'

const run = promisify(execFile)

// AppleScript reaches the system's current input; "missing value" (no volume) parses to null.
async function inputVolume(): Promise<number | null> {
  if (process.platform !== 'darwin') return null
  try {
    const { stdout } = await run('osascript', ['-e', 'input volume of (get volume settings)'])
    return parseInputVolume(stdout)
  } catch {
    return null
  }
}

/** Reads and sets the Mac's input volume, so the mic check can set the singer's level. */
export function registerInputVolumeIpc(): void {
  ipcMain.handle(INPUT_VOLUME_CHANNELS.get, () => inputVolume())
  ipcMain.handle(INPUT_VOLUME_CHANNELS.set, async (_e, raw: unknown) => {
    // Only a whole number 0–100 reaches the script; anything else is ignored.
    const volume = parseInputVolume(raw)
    if (volume === null || process.platform !== 'darwin') return null
    await run('osascript', ['-e', `set volume input volume ${volume}`])
    return inputVolume()
  })
}
