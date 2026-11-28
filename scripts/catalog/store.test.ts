import { describe, expect, it } from 'vitest'
import { searchCatalog } from '../../src/main/catalog/query'
import { editSong, openCatalog, saveSong } from './store'
import { song } from './testing'

describe('editSong', () => {
  it('changes the given fields and replaces the tags, leaving the rest', () => {
    const db = openCatalog(':memory:')
    const id = saveSong(db, song({ genre: 'pop', tags: ['love', 'classic'] }))
    expect(editSong(db, id, { genre: 'rock', tags: ['mellow'] })).toBe(true)
    expect(searchCatalog(db, { query: '' }).items[0]).toMatchObject({
      name: 'Dreams',
      songType: 'band',
      genre: 'rock',
      tags: ['mellow']
    })
  })

  it('reports a song that isn’t there', () => {
    expect(editSong(openCatalog(':memory:'), 7, { genre: 'rock' })).toBe(false)
  })
})
