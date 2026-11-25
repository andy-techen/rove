import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'

/**
 * Writes a file through a temp file and a rename, so a crash mid-write can't leave it
 * half-written. Each write gets its own temp name: with a shared one, two writes of the
 * same file at once (React runs effects twice in development, autosave can overlap)
 * renamed each other's temp file away and the second failed.
 */
export async function writeAtomically(file: string, data: string): Promise<void> {
  const tmp = `${file}.${randomUUID()}.tmp`
  try {
    await fs.writeFile(tmp, data)
    await fs.rename(tmp, file)
  } catch (error) {
    await fs.rm(tmp, { force: true })
    throw error
  }
}
