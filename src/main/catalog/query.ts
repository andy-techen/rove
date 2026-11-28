import type { DatabaseSync, SQLInputValue } from 'node:sqlite'
import {
  CATALOG_GENRES,
  CATALOG_LANGUAGES,
  CATALOG_TAGS,
  CatalogFacets,
  CatalogSearchOptions,
  CatalogSearchResult,
  CatalogSong,
  isGenre,
  isLanguage,
  isSongType,
  isTag,
  CatalogTag
} from '@shared/online/catalog'
import { DEFAULT_LIMIT } from './constants'

interface SongRow {
  id: number
  title: string
  artist: string
  aliases: string
  language: string | null
  song_type: string
  genre: string | null
  duration_sec: number | null
  has_synced_lyrics: number
}

/**
 * Songs matching what the singer typed and picked. Filters OR within a group and AND
 * across groups. Songs still waiting for review never show.
 */
export function searchCatalog(
  db: DatabaseSync,
  options: CatalogSearchOptions
): CatalogSearchResult {
  const where = ["status = 'ok'"]
  const params: SQLInputValue[] = []
  const anyOf = (column: string, values: readonly string[] | undefined): void => {
    if (!values?.length) return
    where.push(`${column} IN (${placeholders(values.length)})`)
    params.push(...values)
  }

  const query = options.query.normalize('NFKC').trim().toLocaleLowerCase()
  if (query) {
    where.push("search_text LIKE ? ESCAPE '\\'")
    params.push(`%${escapeLike(query)}%`)
  }
  anyOf('language', options.languages)
  anyOf('song_type', options.songTypes)
  anyOf('genre', options.genres)
  if (options.syncedLyrics) where.push('has_synced_lyrics = 1')
  if (options.tags?.length) {
    where.push(
      `EXISTS (SELECT 1 FROM song_tags t WHERE t.song_id = songs.id AND t.tag IN (${placeholders(options.tags.length)}))`
    )
    params.push(...options.tags)
  }

  const from = `FROM songs WHERE ${where.join(' AND ')}`
  const { n: total } = db.prepare(`SELECT COUNT(*) AS n ${from}`).get(...params) as { n: number }
  const rows = db
    .prepare(
      `SELECT id, title, artist, aliases, language, song_type, genre, duration_sec, has_synced_lyrics
       ${from} ORDER BY popularity DESC NULLS LAST, title, id LIMIT ?`
    )
    .all(...params, options.limit ?? DEFAULT_LIMIT) as unknown as SongRow[]

  const tags = tagsFor(
    db,
    rows.map((row) => row.id)
  )
  return { items: rows.flatMap((row) => toSong(row, tags.get(row.id) ?? [])), total }
}

/** The languages, genres and tags of the songs the app shows, in the lists' order. */
export function catalogFacets(db: DatabaseSync): CatalogFacets {
  const present = (sql: string): Set<unknown> =>
    new Set((db.prepare(sql).all() as { value: unknown }[]).map((row) => row.value))
  const ok = "FROM songs WHERE status = 'ok'"
  const languages = present(`SELECT DISTINCT language AS value ${ok}`)
  const genres = present(`SELECT DISTINCT genre AS value ${ok}`)
  const tags = present(
    `SELECT DISTINCT tag AS value FROM song_tags WHERE song_id IN (SELECT id ${ok})`
  )
  return {
    languages: CATALOG_LANGUAGES.filter((value) => languages.has(value)),
    genres: CATALOG_GENRES.filter((value) => genres.has(value)),
    tags: CATALOG_TAGS.filter((value) => tags.has(value)),
    syncedLyrics: db.prepare(`SELECT 1 ${ok} AND has_synced_lyrics = 1 LIMIT 1`).get() !== undefined
  }
}

function tagsFor(db: DatabaseSync, ids: number[]): Map<number, CatalogTag[]> {
  const byId = new Map<number, CatalogTag[]>()
  if (!ids.length) return byId
  const rows = db
    .prepare(
      `SELECT song_id, tag FROM song_tags WHERE song_id IN (${placeholders(ids.length)}) ORDER BY tag`
    )
    .all(...ids) as { song_id: number; tag: string }[]
  for (const { song_id, tag } of rows) {
    if (isTag(tag)) byId.set(song_id, [...(byId.get(song_id) ?? []), tag])
  }
  return byId
}

/** A row the app can't show (unknown language or type) is skipped, not fatal. */
function toSong(row: SongRow, tags: CatalogTag[]): CatalogSong[] {
  if (!isLanguage(row.language) || !isSongType(row.song_type)) return []
  const aliases = parseAliases(row.aliases)
  return [
    {
      id: String(row.id),
      name: row.title,
      artist: row.artist,
      language: row.language,
      songType: row.song_type,
      ...(aliases.length && { nameAlts: aliases }),
      ...(isGenre(row.genre) && { genre: row.genre }),
      ...(tags.length && { tags }),
      ...(row.duration_sec !== null && { durationSec: row.duration_sec }),
      hasSyncedLyrics: row.has_synced_lyrics === 1
    }
  ]
}

function parseAliases(json: string): string[] {
  try {
    const value: unknown = JSON.parse(json)
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

function placeholders(count: number): string {
  return Array(count).fill('?').join(', ')
}

function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`)
}
