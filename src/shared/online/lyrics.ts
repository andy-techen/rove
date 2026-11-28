// What both processes agree on for finding lyrics. Searches go to LRCLIB, a free,
// open lyrics database with line-by-line timings: https://lrclib.net/docs

import { LYRICS_RESULTS_MAX } from './constants'

export const LYRICS_CHANNELS = { search: 'lyrics:search' } as const

/** One match from a lyrics search. */
export interface LyricsResult {
  id: number
  title: string
  artist: string
  album: string
  durationSec: number
  /** LRC text with a time on each line, when the database has it. */
  synced: string | null
  plain: string | null
}

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value : null

function parseResult(raw: unknown): LyricsResult | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.id !== 'number' || typeof r.trackName !== 'string') return null
  const synced = text(r.syncedLyrics)
  const plain = text(r.plainLyrics)
  if (!synced && !plain) return null
  return {
    id: r.id,
    title: r.trackName,
    artist: typeof r.artistName === 'string' ? r.artistName : '',
    album: typeof r.albumName === 'string' ? r.albumName : '',
    durationSec: typeof r.duration === 'number' ? r.duration : 0,
    synced,
    plain
  }
}

/**
 * Turns the service's reply into matches worth showing: ones with words, synced ones
 * (a time on each line) first. Anything unexpected is dropped rather than trusted.
 */
export function parseSearchResults(raw: unknown): LyricsResult[] {
  if (!Array.isArray(raw)) return []
  const results = raw.map(parseResult).filter((r): r is LyricsResult => r !== null)
  // A stable sort keeps the service's own ranking within each group.
  results.sort((a, b) => Number(b.synced !== null) - Number(a.synced !== null))
  return results.slice(0, LYRICS_RESULTS_MAX)
}
