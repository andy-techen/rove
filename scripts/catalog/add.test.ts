import { describe, expect, it } from 'vitest'
import { addSong, AddRequest, AddResult } from './add'
import { MbRecording } from './musicbrainz'
import { openCatalog, removeSong, reviewList } from './store'
import { recording } from './testing'

function request(overrides: Partial<AddRequest> = {}): AddRequest {
  return {
    title: 'Dreams',
    artist: 'Fleetwood Mac',
    isrc: null,
    mbid: null,
    language: 'en',
    songType: 'band',
    genre: null,
    tags: [],
    aliases: [],
    ...overrides
  }
}

/** MusicBrainz answering every search with these recordings, and lookups by id. */
function musicBrainz(...recordings: MbRecording[]) {
  return async (url: string) => {
    if (url.includes('/recording?')) return { recordings }
    return recordings.find((r) => url.includes(`/recording/${r.id}?`)) ?? null
  }
}

function idOf(result: AddResult) {
  if (result.kind === 'skipped') throw new Error('Expected a saved song.')
  return result.id
}

describe('addSong', () => {
  it('adds a matched song under MusicBrainz’s name, with its ids and length', async () => {
    const db = openCatalog(':memory:')
    const result = await addSong(db, request({ title: 'dreams' }), musicBrainz(recording()))
    expect(result).toMatchObject({ kind: 'added', title: 'Dreams' })
    expect(db.prepare('SELECT mbid, isrc, duration_sec FROM songs').get()).toEqual({
      mbid: 'mb-dreams',
      isrc: 'USWB19900001',
      duration_sec: 257
    })
  })

  it('refuses a song that is already in the catalog', async () => {
    const db = openCatalog(':memory:')
    const mb = musicBrainz(recording())
    await addSong(db, request(), mb)
    expect(await addSong(db, request({ title: 'DREAMS' }), mb)).toMatchObject({
      kind: 'duplicate'
    })
  })

  it('keeps an unmatched song for review, with the reason', async () => {
    const db = openCatalog(':memory:')
    const result = await addSong(db, request({ language: null }), musicBrainz())
    expect(result.kind).toBe('review')
    expect(reviewList(db)[0].note).toMatch(/No exact match[\s\S]*--lang/)
  })

  it('settles a song waiting for review when it is added again with a pin', async () => {
    const db = openCatalog(':memory:')
    const versions = [recording({ id: 'a' }), recording({ id: 'b', length: 400_000 })]
    const first = await addSong(db, request(), musicBrainz(...versions))
    const second = await addSong(db, request({ mbid: 'b' }), musicBrainz(...versions))
    expect(second).toEqual({
      kind: 'added',
      id: idOf(first),
      title: 'Dreams',
      artist: 'Fleetwood Mac'
    })
    expect(reviewList(db)).toEqual([])
  })

  it('skips a song MusicBrainz has no ISRC for', async () => {
    const db = openCatalog(':memory:')
    const result = await addSong(db, request(), musicBrainz(recording({ isrcs: [] })))
    expect(result).toMatchObject({ kind: 'skipped', reason: 'no ISRC' })
    expect(db.prepare('SELECT COUNT(*) AS n FROM songs').get()).toEqual({ n: 0 })
  })

  it('shows a Chinese song in traditional characters, keeping the simplified name searchable', async () => {
    const db = openCatalog(':memory:')
    const song = recording({ title: '说好不哭', 'artist-credit': [{ name: '周杰伦' }] })
    const typed = request({ title: '说好不哭', artist: '周杰伦', language: 'zh-Hans' })
    await addSong(db, typed, musicBrainz(song))
    expect(db.prepare('SELECT title, artist, language, aliases FROM songs').get()).toEqual({
      title: '說好不哭',
      artist: '周杰倫',
      language: 'zh-Hant',
      aliases: '["说好不哭","周杰伦"]'
    })
  })

  it('removes a song along with its tags', async () => {
    const db = openCatalog(':memory:')
    const id = idOf(await addSong(db, request({ tags: ['classic'] }), musicBrainz(recording())))
    expect(removeSong(db, id)).toBe(true)
    expect(db.prepare('SELECT COUNT(*) AS n FROM song_tags').get()).toEqual({ n: 0 })
  })
})
