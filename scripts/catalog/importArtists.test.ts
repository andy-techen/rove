import { describe, expect, it } from 'vitest'
import { DeezerTrack } from './deezer'
import { importArtist } from './importArtists'
import { openCatalog } from './store'
import { recording } from './testing'

function track(id: number, title: string, rank: number, extra: Partial<DeezerTrack> = {}) {
  return { id, title, rank, isrc: `ISRC${id}`, artist: { name: 'Adele' }, ...extra }
}

/** Deezer and MusicBrainz in one fake: top tracks, each track, and ISRC lookups. */
function services(tracks: DeezerTrack[]) {
  return async (url: string) => {
    if (url.includes('/artist/')) return { data: tracks }
    const id = Number(url.match(/\/track\/(\d+)/)?.[1])
    if (id) return tracks.find((t) => t.id === id) ?? null
    const isrc = url.match(/\/isrc\/(\w+)/)?.[1]
    const t = tracks.find((t) => t.isrc === isrc)
    return (
      t && {
        recordings: [
          recording({
            id: `mb${t.id}`,
            title: t.title,
            isrcs: [isrc!],
            'artist-credit': [{ name: 'Adele' }]
          })
        ]
      }
    )
  }
}

const adele = { deezerId: 1, language: 'en', songType: 'solo', genre: 'pop' } as const

describe('importArtist', () => {
  it('adds the most played plain songs with an ISRC, up to the count', async () => {
    const db = openCatalog(':memory:')
    const tracks = [
      track(1, 'Hello', 500),
      track(2, 'Hello (Live)', 900),
      track(3, 'Skyfall', 400, { isrc: null }),
      track(4, 'Easy On Me', 300),
      track(5, 'Rolling in the Deep', 100)
    ]
    await importArtist(db, adele, 2, services(tracks))
    expect(db.prepare('SELECT title, popularity FROM songs ORDER BY id').all()).toEqual([
      { title: 'Hello', popularity: 500 },
      { title: 'Easy On Me', popularity: 300 }
    ])
  })

  it('skips tracks MusicBrainz does not know instead of keeping them for review', async () => {
    const db = openCatalog(':memory:')
    const fetchJson = services([track(1, 'Hello', 500)])
    await importArtist(db, adele, 1, async (url) =>
      url.includes('/isrc/') ? null : fetchJson(url)
    )
    expect(db.prepare('SELECT COUNT(*) AS n FROM songs').get()).toEqual({ n: 0 })
  })

  it('marks a track credited to two singers as a duet', async () => {
    const db = openCatalog(':memory:')
    const duet = track(1, 'Shallow', 500, { contributors: [{ name: 'A' }, { name: 'B' }] })
    await importArtist(db, adele, 1, services([duet]))
    expect(db.prepare('SELECT song_type FROM songs').get()).toEqual({ song_type: 'duet' })
  })
})
