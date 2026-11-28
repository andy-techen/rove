import { describe, expect, it } from 'vitest'
import { createProject } from '../song/project'
import { songKeyOf } from './songKey'

describe('songKeyOf', () => {
  it('uses the key the song was saved with', async () => {
    const song = { ...createProject('Song', 48000), key: { tonic: 9, mode: 'minor' } as const }
    expect(await songKeyOf(song, {})).toEqual({ tonic: 9, mode: 'minor' })
  })

  it('has no key without music, so tuning uses any note', async () => {
    expect(await songKeyOf(createProject('Song', 48000), {})).toBeNull()
  })
})
