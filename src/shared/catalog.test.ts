import { describe, expect, it } from 'vitest'
import { CatalogSong, parseCatalog, parseSearchOptions, searchCatalog } from './catalog'

const dreams: CatalogSong = {
  id: 'USAT29900609',
  name: 'Dreams',
  artist: 'Fleetwood Mac',
  language: 'en',
  songType: 'band'
}
const yueliang: CatalogSong = {
  id: 'TWA011600101',
  name: '月亮代表我的心',
  artist: '鄧麗君',
  nameAlts: ['Yue Liang Dai Biao Wo De Xin', '月亮代表我的心 (simplified)'],
  language: 'zh-Hant',
  songType: 'solo'
}
const shallow: CatalogSong = {
  id: 'USLR30600001',
  name: 'Shallow',
  artist: 'Lady Gaga & Bradley Cooper',
  language: 'en',
  songType: 'duet'
}

describe('searchCatalog', () => {
  it('matches on title regardless of case', () => {
    const { items } = searchCatalog([dreams, shallow], { query: 'dreams' })
    expect(items).toEqual([dreams])
  })

  it('matches on artist', () => {
    const { items } = searchCatalog([dreams, shallow], { query: 'gaga' })
    expect(items).toEqual([shallow])
  })

  it('matches on pinyin and other script variants', () => {
    const { items } = searchCatalog([yueliang, dreams], { query: 'yue liang' })
    expect(items).toEqual([yueliang])
  })

  it('filters by language and song type together, with multi-select', () => {
    const { items } = searchCatalog([dreams, shallow, yueliang], {
      query: '',
      languages: ['en'],
      songTypes: ['band', 'duet']
    })
    expect(items).toEqual([dreams, shallow])
  })

  it('matches a song that has any of the chosen tags', () => {
    const withTags = [
      { ...dreams, tags: ['classic'] },
      { ...shallow, tags: ['movie'] },
      { ...yueliang, tags: ['love'] }
    ]
    const { items } = searchCatalog(withTags, { query: '', tags: ['classic', 'love'] })
    expect(items.map((s) => s.id)).toEqual([dreams.id, yueliang.id])
  })

  it('returns total alongside the capped items', () => {
    const items: CatalogSong[] = Array.from({ length: 5 }, (_, i) => ({
      ...dreams,
      id: `id-${i}`,
      name: `Song ${i}`
    }))
    const result = searchCatalog(items, { query: '', limit: 2 })
    expect(result.items).toHaveLength(2)
    expect(result.total).toBe(5)
  })
})

describe('parseCatalog', () => {
  it('drops entries missing an id, name, artist, language or song type', () => {
    expect(
      parseCatalog([
        dreams,
        { ...dreams, id: '' },
        { ...dreams, name: '' },
        { ...dreams, artist: '' },
        { ...dreams, language: 'klingon' },
        { ...dreams, songType: 'orchestra' }
      ])
    ).toEqual([dreams])
  })

  it('returns an empty list for a non-array payload', () => {
    expect(parseCatalog(null)).toEqual([])
    expect(parseCatalog({})).toEqual([])
  })
})

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
