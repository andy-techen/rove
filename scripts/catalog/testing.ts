import type { MbRecording } from './musicbrainz'
import type { SongInput } from './store'

// Small builders for the catalog tests.

export function song(overrides: Partial<SongInput> = {}): SongInput {
  return {
    title: 'Dreams',
    artist: 'Fleetwood Mac',
    aliases: [],
    language: 'en',
    songType: 'band',
    genre: null,
    tags: [],
    isrc: null,
    mbid: null,
    durationSec: null,
    deezerId: null,
    popularity: null,
    status: 'ok',
    reviewNote: null,
    ...overrides
  }
}

export function recording(overrides: Partial<MbRecording> = {}): MbRecording {
  return {
    id: 'mb-dreams',
    title: 'Dreams',
    length: 257_000,
    isrcs: ['USWB19900001'],
    'artist-credit': [{ name: 'Fleetwood Mac' }],
    'first-release-date': '1977-02-04',
    ...overrides
  }
}
