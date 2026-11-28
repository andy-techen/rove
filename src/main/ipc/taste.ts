import { ipcMain } from 'electron'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { TASTE_CHANNELS, TasteExample, tasteExamplesOf } from '@shared/polishTaste'
import { requirePlanFor } from './license'
import { MANIFEST, readManifest, songbookDirs } from './songbook'

/** Every vocal track auto polish set across the Songbook, newest song first. */
async function listExamples(): Promise<TasteExample[]> {
  requirePlanFor('autoPolish')
  const examples: TasteExample[] = []
  for (const { dir } of await songbookDirs()) {
    try {
      const manifest = await readManifest(dir)
      const { mtimeMs } = await fs.stat(path.join(dir, MANIFEST))
      examples.push(...tasteExamplesOf(manifest, mtimeMs))
    } catch {
      continue // An unreadable song shouldn't stop Rove learning from the others.
    }
  }
  return examples.sort((a, b) => b.savedAt - a.savedAt)
}

export function registerTasteIpc(): void {
  ipcMain.handle(TASTE_CHANNELS.listExamples, listExamples)
}
