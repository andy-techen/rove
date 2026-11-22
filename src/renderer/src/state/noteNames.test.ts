import { describe, expect, it } from 'vitest'
import { chordName, keyName } from './noteNames'

describe('note names', () => {
  it('names keys the way musicians write them', () => {
    expect(keyName({ tonic: 9, mode: 'minor' })).toBe('A minor')
    expect(keyName({ tonic: 10, mode: 'major' })).toBe('B♭ major')
  })

  it('names chords the way chord sheets write them', () => {
    expect(chordName({ root: 9, quality: 'minor' })).toBe('Am')
    expect(chordName({ root: 6, quality: 'major' })).toBe('F♯')
  })
})
