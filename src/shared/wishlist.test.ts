import { describe, expect, it } from 'vitest'
import { SONG_NAME_MAX_LENGTH } from './constants'
import { cleanText, parseWishlist } from './wishlist'

describe('parseWishlist', () => {
  it('keeps well-formed items and drops the rest', () => {
    const items = parseWishlist([
      { id: 'a', name: 'Dreams', artist: 'Fleetwood Mac', addedAt: 5 },
      { id: 'b', name: '  ' },
      { name: 'No id' },
      null,
      'junk'
    ])
    expect(items).toEqual([{ id: 'a', name: 'Dreams', artist: 'Fleetwood Mac', addedAt: 5 }])
  })

  it('leaves out an empty artist', () => {
    expect(parseWishlist([{ id: 'a', name: 'Dreams', artist: ' ', addedAt: 1 }])).toEqual([
      { id: 'a', name: 'Dreams', addedAt: 1 }
    ])
  })

  it('treats anything but a list as empty', () => {
    expect(parseWishlist({ id: 'a' })).toEqual([])
  })
})

describe('cleanText', () => {
  it('trims and caps the length', () => {
    expect(cleanText('  hi  ')).toBe('hi')
    expect(cleanText('x'.repeat(SONG_NAME_MAX_LENGTH + 5))).toHaveLength(SONG_NAME_MAX_LENGTH)
    expect(cleanText(3)).toBe('')
  })
})
