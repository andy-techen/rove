import type { FetchJson } from './musicbrainz'

// Deezer's public API (no key): an artist's most played tracks, and each track's ISRC.
// https://developers.deezer.com/api

const API = 'https://api.deezer.com'
/** How far down an artist's top tracks to look for enough plain studio songs. */
const TOP_TRACKS = 30

export interface DeezerTrack {
  id: number
  title: string
  title_version?: string
  /** Higher is more played. */
  rank: number
  isrc?: string | null
  artist: { name: string }
  contributors?: { name: string }[]
}

// A version people don't sing along to: live, remixes, karaoke and the like. "(feat. …)"
// and soundtrack credits stay, since those are the song itself.
const OTHER_VERSION =
  /\b(live|remix|mix|version|edit|acoustic|instrumental|demo|karaoke|cover|sped up|slowed|unplugged|session|reprise)\b|伴奏|現場|现场/i

/** The artist's top tracks, most played first. */
export async function topTracks(artistId: number, fetchJson: FetchJson): Promise<DeezerTrack[]> {
  const result = (await fetchJson(`${API}/artist/${artistId}/top?limit=${TOP_TRACKS}`)) as {
    data?: DeezerTrack[]
  } | null
  return [...(result?.data ?? [])].sort((a, b) => b.rank - a.rank)
}

/** Top-track lists leave the ISRC out; the track itself has it. */
export async function trackIsrc(trackId: number, fetchJson: FetchJson): Promise<string | null> {
  const track = (await fetchJson(`${API}/track/${trackId}`)) as DeezerTrack | null
  return track?.isrc || null
}

export function isOtherVersion(track: DeezerTrack): boolean {
  return Boolean(track.title_version?.trim()) || OTHER_VERSION.test(track.title)
}
