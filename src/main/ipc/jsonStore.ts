import { app } from 'electron'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { writeAtomically } from './writeAtomically'

export interface JsonStore<T> {
  /** The saved value, or the fallback when there's no file yet or it can't be read. */
  load(): Promise<T>
  save(value: T): Promise<void>
}

/**
 * A JSON file under userData. Everything read back goes through `parse`, since the file
 * may be from an older version or edited by hand. `compact` skips indenting, for files
 * too large to be worth reading by eye.
 */
export function jsonStore<T>(
  name: string,
  parse: (raw: unknown) => T,
  fallback: T,
  { compact = false }: { compact?: boolean } = {}
): JsonStore<T> {
  const file = (): string => path.join(app.getPath('userData'), name)
  return {
    load: async () => {
      try {
        return parse(JSON.parse(await fs.readFile(file(), 'utf8')))
      } catch {
        return fallback
      }
    },
    save: (value) =>
      writeAtomically(file(), compact ? JSON.stringify(value) : JSON.stringify(value, null, 2))
  }
}
