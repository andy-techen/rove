import { describe, expect, it } from 'vitest'
import { transposeKey } from '../../audio/pitch/key'
import { createProject } from '../song/project'
import { songKeyOf } from './songKey'

describe('songKeyOf', () => {
  it('keeps a key chosen in an older version of Rove', async () => {
    const song = { ...createProject('Song', 48000), key: { tonic: 9, mode: 'minor' } as const }
    expect(await songKeyOf(song, {})).toEqual({ tonic: 9, mode: 'minor' })
  })

  it('has no key without music, so tuning uses any note', async () => {
    expect(await songKeyOf(createProject('Song', 48000), {})).toBeNull()
  })

  it('moves a key up or down, wrapping round the octave', () => {
    expect(transposeKey({ tonic: 11, mode: 'major' }, 2)).toEqual({ tonic: 1, mode: 'major' })
    expect(transposeKey({ tonic: 0, mode: 'minor' }, -1)).toEqual({ tonic: 11, mode: 'minor' })
  })
})
