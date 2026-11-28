import { describe, expect, it } from 'vitest'
import { chordName, keyName } from './noteNames'

describe('note names', () => {
  it('names keys and every kind of chord the way musicians write them', () => {
    expect(keyName({ tonic: 9, mode: 'minor' })).toBe('A minor')
    expect(keyName({ tonic: 10, mode: 'major' })).toBe('B♭ major')
    expect(chordName({ root: 9, quality: 'minor' })).toBe('Am')
    expect(chordName({ root: 6, quality: 'major' })).toBe('F♯')
    expect(chordName({ root: 7, quality: '7' })).toBe('G7')
    expect(chordName({ root: 5, quality: 'maj7' })).toBe('Fmaj7')
    expect(chordName({ root: 2, quality: 'sus4' })).toBe('Dsus4')
    expect(chordName({ root: 11, quality: 'dim' })).toBe('Bdim')
    expect(chordName({ root: 0, quality: 'major', bass: 4 })).toBe('C/E')
  })
})
