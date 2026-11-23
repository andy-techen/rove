// Finds the recording a catalog entry means. The rule is strict on purpose: an exact
// title and artist credit, or a pin (ISRC or MusicBrainz id). Anything looser goes to
// review rather than guessing, because a wrong recording means wrong lyrics timing,
// key and length later on.

const API = 'https://musicbrainz.org/ws/2'
const SEARCH_LIMIT = 25
/** Recordings closer than this are treated as the same take (remaster, reissue). */
const SAME_TAKE_SEC = 3

export interface MbRecording {
  id: string
  title: string
  /** Milliseconds. */
  length?: number | null
  disambiguation?: string
  video?: boolean
  isrcs?: string[]
  'artist-credit'?: { name: string; joinphrase?: string }[]
  'first-release-date'?: string
}

export type Lookup =
  | { kind: 'match'; recording: MbRecording }
  | { kind: 'ambiguous'; candidates: MbRecording[] }
  | { kind: 'none'; candidates: MbRecording[] }

export interface LookupInput {
  title: string
  artist: string
  isrc: string | null
  mbid: string | null
}

/** A JSON GET that returns null for "not found"; the caller handles caching and pacing. */
export type FetchJson = (url: string) => Promise<unknown | null>

export async function lookupRecording(input: LookupInput, fetchJson: FetchJson): Promise<Lookup> {
  if (input.mbid) {
    const recording = (await fetchJson(
      `${API}/recording/${encodeURIComponent(input.mbid)}?inc=isrcs+artist-credits&fmt=json`
    )) as MbRecording | null
    return recording ? { kind: 'match', recording } : { kind: 'none', candidates: [] }
  }
  if (input.isrc) {
    const result = (await fetchJson(
      `${API}/isrc/${encodeURIComponent(input.isrc)}?inc=isrcs+artist-credits&fmt=json`
    )) as { recordings?: MbRecording[] } | null
    const recordings = result?.recordings ?? []
    // The ISRC pins the recording; prefer the entry titled as typed when there are several.
    const recording =
      recordings.find((r) => normalize(r.title) === normalize(input.title)) ?? recordings[0]
    return recording ? { kind: 'match', recording } : { kind: 'none', candidates: [] }
  }
  const query = `recording:"${escapeQuery(input.title)}" AND artist:"${escapeQuery(input.artist)}"`
  const result = (await fetchJson(
    `${API}/recording?query=${encodeURIComponent(query)}&limit=${SEARCH_LIMIT}&fmt=json`
  )) as { recordings?: MbRecording[] } | null
  return pickRecording(result?.recordings ?? [], input.title, input.artist)
}

/**
 * Of the search results, the studio recording with exactly this title and credit. Live
 * takes, videos and other versions carry a disambiguation or flag and are left out.
 *
 * A hit appears on many releases (album, single, compilations, remasters), each its own
 * recording but the same take, so their lengths agree within a few seconds. The take
 * most of them agree on is the one people know; edits and extended mixes are the
 * outliers. With no clear majority, there are several real versions and a human picks.
 */
export function pickRecording(candidates: MbRecording[], title: string, artist: string): Lookup {
  const exact = candidates.filter(
    (r) =>
      !r.video &&
      !r.disambiguation &&
      normalize(r.title) === normalize(title) &&
      normalize(creditOf(r)) === normalize(artist)
  )
  if (!exact.length) return { kind: 'none', candidates: candidates.slice(0, 5) }

  const timed = exact.filter((r) => r.length)
  let pool = exact
  if (timed.length) {
    pool = largestSameTake(timed)
    if (pool.length * 2 <= timed.length) return { kind: 'ambiguous', candidates: exact }
  }
  const [best] = [...pool].sort(
    (a, b) =>
      (b.isrcs?.length ?? 0) - (a.isrcs?.length ?? 0) ||
      releaseDate(a).localeCompare(releaseDate(b)) ||
      a.id.localeCompare(b.id)
  )
  return { kind: 'match', recording: best }
}

/** The biggest group of recordings within SAME_TAKE_SEC of one of them. */
function largestSameTake(timed: MbRecording[]): MbRecording[] {
  const sec = (r: MbRecording): number => (r.length ?? 0) / 1000
  return timed
    .map((center) => timed.filter((r) => Math.abs(sec(r) - sec(center)) <= SAME_TAKE_SEC))
    .reduce((best, group) => (group.length > best.length ? group : best))
}

export function creditOf(recording: MbRecording): string {
  return (recording['artist-credit'] ?? []).map((c) => c.name + (c.joinphrase ?? '')).join('')
}

/** One line per candidate, for the review note and the terminal. */
export function describeCandidates(candidates: MbRecording[]): string[] {
  return candidates.map((r) => {
    const extra = [r.disambiguation, r.video && 'video'].filter(Boolean).join(', ')
    return `${r.id}  ${formatLength(r.length)}  ${r.title} — ${creditOf(r)}${extra ? ` (${extra})` : ''}`
  })
}

function formatLength(ms: number | null | undefined): string {
  if (!ms) return '-:--'
  const sec = Math.round(ms / 1000)
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

/** Undated releases sort last, so the earliest known release wins. */
function releaseDate(recording: MbRecording): string {
  return recording['first-release-date'] || '9999'
}

/** Ignores case, width and quote style, nothing else: "Don't" and "Don’t" match, "Dont" doesn't. */
function normalize(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase()
}

/** Lucene treats these as syntax inside a quoted phrase. */
function escapeQuery(text: string): string {
  return text.replace(/["\\]/g, (c) => `\\${c}`)
}
