import { describe, expect, it } from 'vitest'
import { openCatalog, saveSong, setSyncedLyrics } from '../../../scripts/catalog/store'
import { song } from '../../../scripts/catalog/testing'
import { catalogFacets, searchCatalog } from './query'

function catalog(...songs: Parameters<typeof song>[0][]) {
  const db = openCatalog(':memory:')
  for (const overrides of songs) saveSong(db, song(overrides))
  return db
}

const names = (db: ReturnType<typeof catalog>, options: Parameters<typeof searchCatalog>[1]) =>
  searchCatalog(db, options).items.map((s) => s.name)

const dreams = { title: 'Dreams', artist: 'Fleetwood Mac', tags: ['classic' as const] }
const shallow = {
  title: 'Shallow',
  artist: 'Lady Gaga & Bradley Cooper',
  songType: 'duet' as const,
  tags: ['movie' as const]
}
const yueliang = {
  title: '月亮代表我的心',
  artist: '鄧麗君',
  aliases: ['Yue Liang Dai Biao Wo De Xin'],
  language: 'zh-Hant' as const,
  songType: 'solo' as const,
  tags: ['love' as const]
}

describe('searchCatalog', () => {
  it('matches title, artist and other names, any case', () => {
    const db = catalog(dreams, shallow, yueliang)
    expect(names(db, { query: 'DREAMS' })).toEqual(['Dreams'])
    expect(names(db, { query: 'gaga' })).toEqual(['Shallow'])
    expect(names(db, { query: 'yue liang' })).toEqual(['月亮代表我的心'])
    expect(names(db, { query: '代表我' })).toEqual(['月亮代表我的心'])
  })

  it('treats % and _ in a query as plain characters', () => {
    const db = catalog(dreams, { title: '100% Pure', artist: 'X' })
    expect(names(db, { query: '%' })).toEqual(['100% Pure'])
  })

  it('combines filters: any of a group, all of the groups', () => {
    const db = catalog(dreams, shallow, yueliang)
    expect(names(db, { query: '', languages: ['en'], songTypes: ['band', 'duet'] })).toEqual([
      'Dreams',
      'Shallow'
    ])
    expect(names(db, { query: '', tags: ['classic', 'love'] })).toEqual([
      'Dreams',
      '月亮代表我的心'
    ])
  })

  it('narrows to songs with synced lyrics', () => {
    const db = catalog(dreams, yueliang)
    setSyncedLyrics(db, 2, 99)
    expect(names(db, { query: '', syncedLyrics: true })).toEqual(['月亮代表我的心'])
  })

  it('hides songs that still wait for review', () => {
    const db = catalog(dreams, { ...shallow, status: 'review', language: null })
    expect(names(db, { query: '' })).toEqual(['Dreams'])
  })

  it('returns a page of results with the total', () => {
    const db = catalog(dreams, shallow, yueliang)
    const first = searchCatalog(db, { query: '', limit: 2 })
    const next = searchCatalog(db, { query: '', limit: 2, offset: 2 })
    expect([...first.items, ...next.items].map((s) => s.name).sort()).toEqual(
      ['Dreams', 'Shallow', '月亮代表我的心'].sort()
    )
    expect(next.total).toBe(3)
  })

  it('returns a song in the shape the app shows', () => {
    const db = catalog({ ...yueliang, genre: 'ballad', durationSec: 213 })
    expect(searchCatalog(db, { query: '' }).items[0]).toEqual({
      id: '1',
      name: '月亮代表我的心',
      artist: '鄧麗君',
      nameAlts: ['Yue Liang Dai Biao Wo De Xin'],
      language: 'zh-Hant',
      songType: 'solo',
      genre: 'ballad',
      tags: ['love'],
      durationSec: 213,
      hasSyncedLyrics: false
    })
  })
})

describe('catalogFacets', () => {
  it('lists the values shown songs have, in the lists’ order', () => {
    const db = catalog(
      { ...dreams, genre: 'rock' },
      { ...yueliang, genre: 'ballad' },
      { ...shallow, genre: 'pop', tags: ['wedding'], status: 'review' }
    )
    expect(catalogFacets(db)).toEqual({
      languages: ['en', 'zh-Hant'],
      genres: ['rock', 'ballad'],
      tags: ['love', 'classic'],
      syncedLyrics: false
    })
  })
})
