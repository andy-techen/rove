import { describe, expect, it } from 'vitest'
import { matchesSearch } from './search'

const song = { name: 'Fly Away', artist: 'Sam Lee' }

describe('matchesSearch', () => {
  it('matches the name or the artist, ignoring case and spaces around', () => {
    expect(matchesSearch(song, ' fly ')).toBe(true)
    expect(matchesSearch(song, 'LEE')).toBe(true)
    expect(matchesSearch(song, 'sunset')).toBe(false)
  })

  it('matches everything when nothing is typed', () => {
    expect(matchesSearch({ name: 'Sunset' }, '  ')).toBe(true)
  })
})
