import { ipcMain } from 'electron'
import { promises as fs } from 'node:fs'
import seedFile from '../../../resources/catalog/seed.json?asset'
import {
  CATALOG_CHANNELS,
  CatalogSearchResult,
  CatalogSong,
  parseCatalog,
  parseSearchOptions,
  searchCatalog
} from '@shared/catalog'

// The curated catalog is read-only and shipped with the app. Today it's a small JSON
// seed, read once and kept in memory; the catalog pipeline (MusicBrainz + Deezer →
// SQLite) replaces this with a bundled .sqlite file without changing the IPC shape.
let cache: CatalogSong[] | null = null

async function load(): Promise<CatalogSong[]> {
  if (cache) return cache
  try {
    cache = parseCatalog(JSON.parse(await fs.readFile(seedFile, 'utf8')))
  } catch {
    // A missing or malformed seed shouldn't take the Songbook down; Explore just
    // shows "no songs yet" until a proper catalog ships.
    cache = []
  }
  return cache
}

export function registerCatalogIpc(): void {
  ipcMain.handle(
    CATALOG_CHANNELS.search,
    async (_e, raw: unknown): Promise<CatalogSearchResult> => {
      const options = parseSearchOptions(raw)
      return searchCatalog(await load(), options)
    }
  )
}
