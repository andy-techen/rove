import { LyricsResult, parseSearchResults } from '../../src/shared/online/lyrics'
import { toTraditional } from './chinese'
import { SAME_LYRICS_SEC } from './constants'
import type { FetchJson } from './musicbrainz'

// LRCLIB, the open lyrics database the app searches: https://lrclib.net/docs
// The catalog stores only whether it has synced lyrics for a song, never the lyrics.

const SEARCH = 'https://lrclib.net/api/search'

export interface LyricsLookup {
  title: string
  artist: string
  durationSec: number | null
}

/**
 * LRCLIB's id for synced lyrics of this exact recording, or null. Searches by title and
 * artist, then by title alone, since LRCLIB often credits Chinese artists differently
 * ("G.E.M." for 鄧紫棋). Only a same-named entry of the same length counts.
 */
export async function findSyncedLyrics(
  song: LyricsLookup,
  fetchJson: FetchJson
): Promise<number | null> {
  const { durationSec } = song
  if (durationSec === null) return null
  const searches: Record<string, string>[] = [
    { track_name: song.title, artist_name: song.artist },
    { track_name: song.title }
  ]
  for (const params of searches) {
    const results = parseSearchResults(await fetchJson(`${SEARCH}?${new URLSearchParams(params)}`))
    const match = results.find((result) => isSameSong(result, song.title, durationSec))
    if (match) return match.id
  }
  return null
}

export function isSameSong(result: LyricsResult, title: string, durationSec: number): boolean {
  return (
    result.synced !== null &&
    Math.abs(result.durationSec - durationSec) <= SAME_LYRICS_SEC &&
    plainName(result.title) === plainName(title)
  )
}

/**
 * Case, width, script (simplified or traditional) and typographic dashes and quotes
 * (MusicBrainz writes "Anti‐Hero" with U+2010) don't make a different song.
 */
function plainName(name: string): string {
  const plain = name
    .normalize('NFKC')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
  return toTraditional(plain.trim().toLocaleLowerCase())
}
