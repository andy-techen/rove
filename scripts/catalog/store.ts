import { DatabaseSync } from 'node:sqlite'
import { migrate } from '../../src/main/catalog/schema'
import { buildSearchText } from '../../src/main/catalog/searchText'
import type {
  CatalogGenre,
  CatalogLanguage,
  CatalogSongType
} from '../../src/shared/online/catalog'

// Writes to the catalog. Only the curation scripts use this; the app opens the file
// read-only (src/main/ipc/catalog.ts).

export interface SongInput {
  title: string
  artist: string
  /** Other names to search by: the name as typed, translations, romanisations. */
  aliases: string[]
  language: CatalogLanguage | null
  songType: CatalogSongType
  genre: CatalogGenre | null
  tags: string[]
  isrc: string | null
  mbid: string | null
  durationSec: number | null
  deezerId: number | null
  /** Deezer's rank: higher is more listened to. Orders Explore's results. */
  popularity: number | null
  status: 'ok' | 'review'
  /** Why a song needs a human, and what to try. */
  reviewNote: string | null
}

export interface ReviewRow {
  id: number
  title: string
  artist: string
  note: string | null
}

export function openCatalog(path: string): DatabaseSync {
  const db = new DatabaseSync(path)
  db.exec('PRAGMA foreign_keys = ON')
  migrate(db)
  return db
}

/** Same recording (ISRC or MusicBrainz id), or the same title and artist. */
export function findDuplicate(
  db: DatabaseSync,
  song: SongInput,
  ignoreId: number | null = null
): { id: number; title: string; artist: string } | undefined {
  return db
    .prepare(
      `SELECT id, title, artist FROM songs
       WHERE (isrc = ? OR mbid = ? OR (title = ? AND artist = ?)) AND id IS NOT ?
       LIMIT 1`
    )
    .get(song.isrc, song.mbid, song.title, song.artist, ignoreId) as
    { id: number; title: string; artist: string } | undefined
}

/** A song added earlier that still waits for review, so adding it again can settle it. */
export function findReviewRow(db: DatabaseSync, title: string, artist: string): number | null {
  const row = db
    .prepare(`SELECT id FROM songs WHERE status = 'review' AND title = ? AND artist = ?`)
    .get(title, artist) as { id: number } | undefined
  return row?.id ?? null
}

/** Inserts a song, or replaces the one at `replaceId`, tags included. Returns its id. */
export function saveSong(
  db: DatabaseSync,
  song: SongInput,
  replaceId: number | null = null
): number {
  const aliases = [...new Set(song.aliases)].filter(
    (name) => name !== song.title && name !== song.artist
  )
  const values = [
    song.isrc,
    song.mbid,
    song.title,
    song.artist,
    JSON.stringify(aliases),
    song.language,
    song.songType,
    song.genre,
    song.durationSec,
    song.deezerId,
    song.popularity,
    song.status,
    song.reviewNote,
    buildSearchText(song.title, song.artist, aliases)
  ]
  return transaction(db, () => {
    let id: number
    if (replaceId === null) {
      const result = db
        .prepare(
          `INSERT INTO songs (isrc, mbid, title, artist, aliases, language, song_type, genre,
             duration_sec, deezer_id, popularity, status, review_note, search_text)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(...values)
      id = Number(result.lastInsertRowid)
    } else {
      db.prepare(
        `UPDATE songs SET isrc = ?, mbid = ?, title = ?, artist = ?, aliases = ?, language = ?,
           song_type = ?, genre = ?, duration_sec = ?, deezer_id = ?, popularity = ?, status = ?, review_note = ?, search_text = ?
         WHERE id = ?`
      ).run(...values, replaceId)
      db.prepare('DELETE FROM song_tags WHERE song_id = ?').run(replaceId)
      id = replaceId
    }
    const addTag = db.prepare('INSERT OR IGNORE INTO song_tags (song_id, tag) VALUES (?, ?)')
    for (const tag of song.tags) addTag.run(id, tag)
    return id
  })
}

export function removeSong(db: DatabaseSync, id: number): boolean {
  return db.prepare('DELETE FROM songs WHERE id = ?').run(id).changes > 0
}

export function reviewList(db: DatabaseSync): ReviewRow[] {
  return db
    .prepare(
      `SELECT id, title, artist, review_note AS note FROM songs WHERE status = 'review' ORDER BY id`
    )
    .all() as unknown as ReviewRow[]
}

/**
 * Records when the catalog last changed and how many songs the app shows, then compacts
 * the file so the committed copy stays small and its SQL dump diffs cleanly.
 */
export function finishWrite(db: DatabaseSync, now: Date = new Date()): void {
  const { n } = db.prepare(`SELECT COUNT(*) AS n FROM songs WHERE status = 'ok'`).get() as {
    n: number
  }
  const setMeta = db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)')
  setMeta.run('updated_at', now.toISOString())
  setMeta.run('count', String(n))
  db.exec('VACUUM')
}

function transaction<T>(db: DatabaseSync, work: () => T): T {
  db.exec('BEGIN')
  try {
    const result = work()
    db.exec('COMMIT')
    return result
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}
