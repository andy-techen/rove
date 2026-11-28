import type { DatabaseSync } from 'node:sqlite'
import type {
  CatalogGenre,
  CatalogLanguage,
  CatalogSongType
} from '../../src/shared/online/catalog'
import { isChinese, toTraditional } from './chinese'
import { creditOf, describeCandidates, FetchJson, lookupRecording } from './musicbrainz'
import { findDuplicate, findReviewRow, saveSong, SongInput } from './store'

export interface AddRequest {
  title: string
  artist: string
  isrc: string | null
  mbid: string | null
  language: CatalogLanguage | null
  songType: CatalogSongType
  genre: CatalogGenre | null
  tags: string[]
  aliases: string[]
  deezerId?: number
  popularity?: number
  /** Skip a song MusicBrainz can't place instead of keeping it for review (bulk imports). */
  skipUnmatched?: boolean
}

export type AddResult =
  | { kind: 'added'; id: number; title: string; artist: string }
  | { kind: 'review'; id: number; title: string; artist: string; note: string }
  | { kind: 'duplicate'; id: number; title: string; artist: string }
  | { kind: 'skipped'; title: string; artist: string; reason: string }

/**
 * Looks the song up and saves it. A song we can't place for sure is still saved, marked
 * for review with the reason, so nothing typed is lost. Adding the same title and artist
 * again (say, with --mbid) settles a song that waits for review.
 */
export async function addSong(
  db: DatabaseSync,
  request: AddRequest,
  fetchJson: FetchJson
): Promise<AddResult> {
  const lookup = await lookupRecording(request, fetchJson)
  const notes: string[] = []
  let song: SongInput = {
    title: request.title,
    artist: request.artist,
    aliases: request.aliases,
    language: request.language,
    songType: request.songType,
    genre: request.genre,
    tags: request.tags,
    isrc: request.isrc,
    mbid: request.mbid,
    durationSec: null,
    deezerId: request.deezerId ?? null,
    popularity: request.popularity ?? null,
    status: 'ok',
    reviewNote: null
  }

  if (lookup.kind === 'match') {
    const { recording } = lookup
    song = {
      ...song,
      // MusicBrainz's spelling becomes the display name; what was typed stays searchable.
      title: recording.title,
      artist: creditOf(recording) || request.artist,
      aliases: [request.title, request.artist, ...request.aliases],
      mbid: recording.id,
      isrc: request.isrc ?? [...(recording.isrcs ?? [])].sort()[0] ?? null,
      durationSec: recording.length ? Math.round(recording.length / 100) / 10 : null
    }
    // The ISRC is how later phases join other sources (Deezer, LRCLIB) without
    // guessing, so a song without one isn't worth carrying.
    if (!song.isrc) {
      return { kind: 'skipped', title: song.title, artist: song.artist, reason: 'no ISRC' }
    }
  } else if (request.skipUnmatched) {
    return { kind: 'skipped', title: song.title, artist: song.artist, reason: 'not on MusicBrainz' }
  } else if (lookup.kind === 'ambiguous') {
    notes.push(
      'Several versions with different lengths; add again with --mbid <id>:',
      ...describeCandidates(lookup.candidates)
    )
  } else {
    notes.push(
      request.isrc || request.mbid
        ? 'MusicBrainz has no recording with that id.'
        : 'No exact match on MusicBrainz; check the spelling or add again with --mbid <id>.',
      ...describeCandidates(lookup.candidates)
    )
  }
  if (isChinese(song.language)) {
    song = {
      ...song,
      title: toTraditional(song.title),
      artist: toTraditional(song.artist),
      aliases: [song.title, song.artist, ...song.aliases],
      language: 'zh-Hant'
    }
  }
  if (!song.language) notes.push('No language; add again with --lang.')
  if (notes.length) song = { ...song, status: 'review', reviewNote: notes.join('\n') }

  const replaceId = findReviewRow(db, request.title, request.artist)
  const duplicate = findDuplicate(db, song, replaceId)
  if (duplicate) return { kind: 'duplicate', ...duplicate }

  const id = saveSong(db, song, replaceId)
  return song.status === 'ok'
    ? { kind: 'added', id, title: song.title, artist: song.artist }
    : { kind: 'review', id, title: song.title, artist: song.artist, note: song.reviewNote ?? '' }
}
