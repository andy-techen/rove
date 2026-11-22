import { ipcMain } from 'electron'
import { promises as fs } from 'node:fs'
import scnetModel from '../../../resources/models/scnet/scnet.int8.onnx?asset&asarUnpack'

export const SEPARATION_MODEL_CHANNEL = 'separation:model'

/** Hands the bundled vocal removal model (SCNet, MIT) to the page that runs it. */
export function registerSeparationIpc(): void {
  ipcMain.handle(
    SEPARATION_MODEL_CHANNEL,
    async () => new Uint8Array(await fs.readFile(scnetModel))
  )
}
