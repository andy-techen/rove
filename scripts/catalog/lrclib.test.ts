import { describe, expect, it } from 'vitest'
import { findSyncedLyrics } from './lrclib'

const synced = '[00:01.00] la'

function entry(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    trackName: '小幸運',
    artistName: '田馥甄',
    duration: 265,
    syncedLyrics: synced,
    ...overrides
  }
}

/** LRCLIB answering searches with an artist with one list, and title-only ones with another. */
function lrclib(withArtist: unknown[], titleOnly: unknown[] = []) {
  return async (url: string) => (url.includes('artist_name') ? withArtist : titleOnly)
}

const lookup = { title: '小幸運', artist: '田馥甄', durationSec: 266 }

describe('findSyncedLyrics', () => {
  it.each([
    ['a same-length entry with synced lyrics', [entry()], 1],
    ['the same name in the other script', [entry({ trackName: '小幸运' })], 1],
    [
      'the same name without its bracketed extra',
      [entry({ trackName: '滿座' })],
      1,
      '滿座 (Full House)'
    ],
    ['the same name with a plain dash', [entry({ trackName: 'Anti-Hero' })], 1, 'Anti\u2010Hero'],
    ['a different length (another recording)', [entry({ duration: 280 })], null],
    ['only plain lyrics', [entry({ syncedLyrics: null, plainLyrics: 'la' })], null],
    ['another song by the artist', [entry({ trackName: '你就不要想起我' })], null]
  ])('takes %s', async (_case, results, expected, title = lookup.title) => {
    expect(await findSyncedLyrics({ ...lookup, title }, lrclib(results))).toBe(expected)
  })

  it('falls back to the title alone when LRCLIB credits the artist differently', async () => {
    const found = lrclib([], [entry({ id: 9, artistName: 'Hebe Tien' })])
    expect(await findSyncedLyrics(lookup, found)).toBe(9)
  })
})
