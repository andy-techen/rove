import { describe, expect, it } from 'vitest'
import { RECENT_COLOURS, withRecent } from './recentColours'

describe('withRecent', () => {
  it('puts the newest colour first', () => {
    expect(withRecent(['#111111', '#222222'], '#333333')).toEqual(['#333333', '#111111', '#222222'])
  })

  it('moves a colour used again to the front instead of listing it twice', () => {
    expect(withRecent(['#111111', '#222222'], '#222222')).toEqual(['#222222', '#111111'])
  })

  it('treats the same colour in other letters as one', () => {
    expect(withRecent(['#aabbcc'], '#AABBCC')).toEqual(['#aabbcc'])
  })

  it('keeps one more than it offers, so a full set shows beside the colour in use', () => {
    const many = Array.from({ length: RECENT_COLOURS + 3 }, (_, i) => `#00000${i}`)
    expect(many.reduce(withRecent, [] as string[])).toHaveLength(RECENT_COLOURS + 1)
  })
})
