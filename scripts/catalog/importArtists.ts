import type { DatabaseSync } from 'node:sqlite'
import type {
  CatalogGenre,
  CatalogLanguage,
  CatalogSongType
} from '../../src/shared/online/catalog'
import { addSong, AddResult } from './add'
import { isOtherVersion, topTracks, trackIsrc } from './deezer'
import type { FetchJson } from './musicbrainz'

export interface ArtistPick {
  deezerId: number
  language: CatalogLanguage
  songType: CatalogSongType
  genre: CatalogGenre | null
}

/**
 * Adds an artist's most played songs until `count` are in, walking down Deezer's top
 * tracks. Each is pinned by its ISRC, so MusicBrainz finds the exact recording.
 */
export async function importArtist(
  db: DatabaseSync,
  artist: ArtistPick,
  count: number,
  fetchJson: FetchJson,
  onResult: (result: AddResult) => void = () => {}
): Promise<AddResult[]> {
  const results: AddResult[] = []
  let added = 0
  for (const track of await topTracks(artist.deezerId, fetchJson)) {
    if (added >= count) break
    if (isOtherVersion(track)) continue
    const isrc = await trackIsrc(track.id, fetchJson)
    if (!isrc) continue
    const result = await addSong(
      db,
      {
        title: track.title,
        artist: track.artist.name,
        isrc,
        mbid: null,
        language: artist.language,
        // A track credited to two singers is sung as a duet.
        songType: (track.contributors?.length ?? 1) > 1 ? 'duet' : artist.songType,
        genre: artist.genre,
        tags: [],
        aliases: [],
        deezerId: track.id,
        popularity: track.rank,
        // Deezer lists many regional releases MusicBrainz doesn't know; skip rather than
        // fill the review list with them.
        skipUnmatched: true
      },
      fetchJson
    )
    results.push(result)
    onResult(result)
    if (result.kind === 'added') added++
  }
  return results
}
