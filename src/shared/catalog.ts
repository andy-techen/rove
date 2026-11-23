// A curated "what should I sing?" catalog, read-only and shipped with the app. Today
// the seed lives in resources/catalog/seed.json; a later version swaps in a bundled
// SQLite file built from MusicBrainz and Deezer. Either way the renderer only sees
// what the search call returns, so the storage change stays behind the IPC seam.

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

const DEFAULT_LIMIT = 100

/** What the singer typed, matched against name, artist and any script variants, any case. */
function matchesQuery(song: CatalogSong, q: string): boolean {
  if (!q) return true
  const haystack = [song.name, song.artist, ...(song.nameAlts ?? [])]
  return haystack.some((text) => text.toLocaleLowerCase().includes(q))
}

/** Pure, so unit tests can drive it directly and the SQLite swap won't change behaviour. */
export function searchCatalog(
  items: CatalogSong[],
  options: CatalogSearchOptions
): CatalogSearchResult {
  const q = options.query.trim().toLocaleLowerCase()
  const limit = options.limit ?? DEFAULT_LIMIT
  const matched: CatalogSong[] = []
  for (const song of items) {
    if (options.languages?.length && !options.languages.includes(song.language)) continue
    if (options.songTypes?.length && !options.songTypes.includes(song.songType)) continue
    if (options.genres?.length && (!song.genre || !options.genres.includes(song.genre))) continue
    if (options.tags?.length && !(song.tags ?? []).some((tag) => options.tags!.includes(tag))) {
      continue
    }
    if (!matchesQuery(song, q)) continue
    matched.push(song)
  }
  return { items: matched.slice(0, limit), total: matched.length }
}

/** Keeps only well-formed rows; a bad entry shouldn't take the catalog down. */
export function parseCatalog(raw: unknown): CatalogSong[] {
  if (!Array.isArray(raw)) return []
  const songs: CatalogSong[] = []
  for (const entry of raw) {
    const e = entry as Partial<CatalogSong> | null
    if (
      !e ||
      typeof e.id !== 'string' ||
      !e.id ||
      typeof e.name !== 'string' ||
      !e.name ||
      typeof e.artist !== 'string' ||
      !e.artist ||
      !isLanguage(e.language) ||
      !isSongType(e.songType)
    ) {
      continue
    }
    songs.push({
      id: e.id,
      name: e.name,
      artist: e.artist,
      language: e.language,
      songType: e.songType,
      ...(Array.isArray(e.nameAlts) &&
        e.nameAlts.every((a) => typeof a === 'string') && { nameAlts: e.nameAlts }),
      ...(isGenre(e.genre) && { genre: e.genre }),
      ...(Array.isArray(e.tags) &&
        e.tags.every((tag) => typeof tag === 'string') && { tags: e.tags }),
      ...(typeof e.durationSec === 'number' && { durationSec: e.durationSec }),
      ...(typeof e.hasSyncedLyrics === 'boolean' && { hasSyncedLyrics: e.hasSyncedLyrics })
    })
  }
  return songs
}

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

function isLanguage(value: unknown): value is CatalogLanguage {
  return (CATALOG_LANGUAGES as readonly string[]).includes(value as string)
}

function isSongType(value: unknown): value is CatalogSongType {
  return (CATALOG_SONG_TYPES as readonly string[]).includes(value as string)
}

function isGenre(value: unknown): value is CatalogGenre {
  return (CATALOG_GENRES as readonly string[]).includes(value as string)
}
