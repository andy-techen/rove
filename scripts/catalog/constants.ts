// MusicBrainz
export const SEARCH_LIMIT = 25
/** Recordings closer than this are treated as the same take (remaster, reissue). */
export const SAME_TAKE_SEC = 3

// Deezer
/** How far down an artist's top tracks to look for enough plain studio songs. */
export const TOP_TRACKS = 30

// Requests
// MusicBrainz asks for at most one request per second:
// https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting
export const MIN_GAP_MS = 1100
/** When it answers 503 (too fast, or busy, which is common), back off up to a minute. */
export const RETRY_DELAYS_MS = [2000, 4000, 8000, 16_000, 30_000, 60_000]
