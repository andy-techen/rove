import { ipcMain } from 'electron'
import { DatabaseSync } from 'node:sqlite'
import catalogFile from '../../../../resources/catalog/catalog.sqlite?asset'
import { CATALOG_CHANNELS, CatalogSearchResult, parseSearchOptions } from '@shared/online/catalog'
import { searchCatalog } from '../../catalog/query'
import { CATALOG_SCHEMA_VERSION, schemaVersion } from '../../catalog/schema'

// The curated catalog ships with the app as a read-only SQLite file, written only by
// the curation scripts (scripts/catalog). Opened once, on the first search.
let db: DatabaseSync | null | undefined

function open(): DatabaseSync | null {
  if (db !== undefined) return db
  try {
    db = new DatabaseSync(catalogFile, { readOnly: true })
    const version = schemaVersion(db)
    // A file from a newer build may have columns this code doesn't understand.
    if (version < 1 || version > CATALOG_SCHEMA_VERSION) {
      db.close()
      db = null
    }
  } catch {
    // A missing or broken catalog shouldn't take the Songbook down; Explore just shows
    // its empty state.
    db = null
  }
  return db
}

export function registerCatalogIpc(): void {
  ipcMain.handle(CATALOG_CHANNELS.search, (_e, raw: unknown): CatalogSearchResult => {
    const catalog = open()
    return catalog ? searchCatalog(catalog, parseSearchOptions(raw)) : { items: [], total: 0 }
  })
}
