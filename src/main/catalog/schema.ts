import type { DatabaseSync } from 'node:sqlite'

// The catalog's schema, one entry per version. The version lives in SQLite's own
// `user_version`, so the app can tell an older or newer file apart without a query.
// Never edit a shipped entry; add a new one.
const MIGRATIONS: readonly string[] = [
  `
  CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE songs (
    id INTEGER PRIMARY KEY,
    isrc TEXT UNIQUE,
    mbid TEXT UNIQUE,
    deezer_id INTEGER,
    lrclib_id INTEGER,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    aliases TEXT NOT NULL DEFAULT '[]',
    language TEXT,
    song_type TEXT NOT NULL DEFAULT 'solo',
    genre TEXT,
    duration_sec REAL,
    bpm REAL,
    popularity INTEGER,
    has_synced_lyrics INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'ok' CHECK (status IN ('ok', 'review')),
    review_note TEXT,
    search_text TEXT NOT NULL,
    UNIQUE (title, artist),
    -- A song can wait for review without a language, but never reach the app without one.
    CHECK (status = 'review' OR language IS NOT NULL)
  );
  CREATE TABLE song_tags (
    song_id INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
    tag TEXT NOT NULL,
    PRIMARY KEY (song_id, tag)
  );
  `
]

export const CATALOG_SCHEMA_VERSION = MIGRATIONS.length

export function schemaVersion(db: DatabaseSync): number {
  const row = db.prepare('PRAGMA user_version').get() as { user_version: number }
  return row.user_version
}

/** Brings a writable catalog up to the latest schema. Only the curation scripts call this. */
export function migrate(db: DatabaseSync): void {
  const from = schemaVersion(db)
  if (from > CATALOG_SCHEMA_VERSION) {
    throw new Error(
      `Catalog schema ${from} is newer than this code knows (${CATALOG_SCHEMA_VERSION}).`
    )
  }
  for (let version = from; version < CATALOG_SCHEMA_VERSION; version++) {
    db.exec('BEGIN')
    try {
      db.exec(MIGRATIONS[version])
      db.exec(`PRAGMA user_version = ${version + 1}`)
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
  }
}
