import { describe, expect, it } from 'vitest'
import { parseSearchResults } from './lyrics'
import { LYRICS_RESULTS_MAX } from './constants'

const hit = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 1,
  trackName: 'Song',
  artistName: 'Singer',
  albumName: 'Album',
  duration: 200,
  instrumental: false,
  plainLyrics: 'Hello\nWorld',
  syncedLyrics: '[00:01.00] Hello\n[00:02.00] World',
  ...over
})

describe('parseSearchResults', () => {
  it('keeps what Rove needs from each match', () => {
    expect(parseSearchResults([hit()])).toEqual([
      {
        id: 1,
        title: 'Song',
        artist: 'Singer',
        album: 'Album',
        durationSec: 200,
        synced: '[00:01.00] Hello\n[00:02.00] World',
        plain: 'Hello\nWorld'
      }
    ])
  })

  it('drops matches with no words and anything malformed', () => {
    const results = parseSearchResults([
      hit({ id: 2, plainLyrics: null, syncedLyrics: null, instrumental: true }),
      hit({ id: 3, trackName: 42 }),
      'nonsense',
      hit({ id: 4 })
    ])
    expect(results.map((r) => r.id)).toEqual([4])
  })

  it('puts matches that follow along first, and keeps the list short', () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      hit({ id: i, syncedLyrics: i % 2 ? 'x' : null })
    )
    const results = parseSearchResults(many)
    expect(results).toHaveLength(LYRICS_RESULTS_MAX)
    expect(results[0].synced).not.toBeNull()
  })

  it('reads anything that is not a list as no matches', () => {
    expect(parseSearchResults({ error: 'oops' })).toEqual([])
  })
})
