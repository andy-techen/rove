import { describe, expect, it } from 'vitest'
import { parseSearchOptions } from './catalog'

describe('parseSearchOptions', () => {
  it('keeps safe multi-select fields and drops unknown values', () => {
    expect(
      parseSearchOptions({
        query: 'moon',
        languages: ['zh-Hant', 'klingon'],
        songTypes: ['solo'],
        tags: ['love', ''],
        limit: 10
      })
    ).toEqual({
      query: 'moon',
      languages: ['zh-Hant'],
      songTypes: ['solo'],
      tags: ['love'],
      limit: 10
    })
  })

  it('falls back to an empty query when nothing usable arrives', () => {
    expect(parseSearchOptions(undefined)).toEqual({ query: '' })
    expect(parseSearchOptions({ languages: 'nope', limit: -1 })).toEqual({ query: '' })
  })
})
