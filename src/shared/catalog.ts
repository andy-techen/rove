// A curated "what should I sing?" catalog, read-only and shipped with the app as
// resources/catalog/catalog.sqlite. The main process queries it (src/main/catalog);
// the curation scripts in scripts/catalog write it. The renderer only sees what the
// search call returns.

export const CATALOG_LANGUAGES = ['en', 'zh-Hans', 'zh-Hant', 'ja', 'ko', 'es', 'other'] as const
export type CatalogLanguage = (typeof CATALOG_LANGUAGES)[number]

export const CATALOG_SONG_TYPES = ['solo', 'duet', 'band'] as const
export type CatalogSongType = (typeof CATALOG_SONG_TYPES)[number]

export const CATALOG_GENRES = [
  'pop',
  'rock',
  'ballad',
  'r&b',
  'folk',
  'country',
  'hiphop',
  'jazz',
  'classical',
  'other'
] as const
export type CatalogGenre = (typeof CATALOG_GENRES)[number]

export interface CatalogSong {
  /** Stable id, usually an ISRC; a synthetic id for the handful that don't have one. */
  id: string
  name: string
  artist: string
  /** Pinyin, simplified or traditional variants, so search finds the song however it's typed. */
  nameAlts?: string[]
  language: CatalogLanguage
  songType: CatalogSongType
  /** The song's genre; free-form on disk but narrowed to CATALOG_GENRES so filters stay tidy. */
  genre?: CatalogGenre
  /** Free-form tags for moods and occasions: "love", "karaoke-classic", "wedding". */
  tags?: string[]
  /** Seconds, when known; used to disambiguate lyrics lookups later. */
  durationSec?: number
  /** True when LRCLIB has synced lyrics for this song; the UI can promote them. */
  hasSyncedLyrics?: boolean
}

export interface CatalogSearchOptions {
  query: string
  /** Any of these languages (OR). Omitted or empty means "all languages". */
  languages?: CatalogLanguage[]
  /** Any of these song types (OR). */
  songTypes?: CatalogSongType[]
  /** Any of these genres (OR). */
  genres?: CatalogGenre[]
  /** Any of these tags (OR): a song matches when it has at least one of them. */
  tags?: string[]
  limit?: number
}

export interface CatalogSearchResult {
  items: CatalogSong[]
  /** Items found before `limit`, so the UI can say "500 more" if the list is long. */
  total: number
}

export const CATALOG_CHANNELS = {
  search: 'catalog:search'
} as const

/** The options as they arrive over IPC: anything odd falls back to a safe default. */
export function parseSearchOptions(raw: unknown): CatalogSearchOptions {
  const r = (raw ?? {}) as Partial<CatalogSearchOptions>
  const languages = pickArray(r.languages, isLanguage)
  const songTypes = pickArray(r.songTypes, isSongType)
  const genres = pickArray(r.genres, isGenre)
  const tags = pickArray(r.tags, (v): v is string => typeof v === 'string' && v.length > 0)
  return {
    query: typeof r.query === 'string' ? r.query : '',
    ...(languages.length && { languages }),
    ...(songTypes.length && { songTypes }),
    ...(genres.length && { genres }),
    ...(tags.length && { tags }),
    ...(typeof r.limit === 'number' && r.limit > 0 && { limit: Math.floor(r.limit) })
  }
}

/** Keep only the entries a type guard accepts; a non-array becomes []. */
function pickArray<T>(value: unknown, guard: (v: unknown) => v is T): T[] {
  return Array.isArray(value) ? value.filter(guard) : []
}

export function isLanguage(value: unknown): value is CatalogLanguage {
  return (CATALOG_LANGUAGES as readonly string[]).includes(value as string)
}

export function isSongType(value: unknown): value is CatalogSongType {
  return (CATALOG_SONG_TYPES as readonly string[]).includes(value as string)
}

export function isGenre(value: unknown): value is CatalogGenre {
  return (CATALOG_GENRES as readonly string[]).includes(value as string)
}
