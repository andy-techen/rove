import { describe, expect, it } from 'vitest'
import { chartFromText } from './chordText'
import { chordsInKey, keyOfChart } from './keyChords'
import { chordName } from './noteNames'

const bars = (text: string) => chartFromText(text).bars

describe('chordsInKey', () => {
  it('offers the six chords of a major key, home chord first', () => {
    expect(chordsInKey({ tonic: 0, mode: 'major' }).map(chordName)).toEqual([
      'C',
      'Dm',
      'Em',
      'F',
      'G',
      'Am'
    ])
  })

  it('offers a minor key the chords of its relative major, from its own home', () => {
    expect(chordsInKey({ tonic: 9, mode: 'minor' }).map(chordName)).toEqual([
      'Am',
      'C',
      'Dm',
      'Em',
      'F',
      'G'
    ])
  })
})

describe('keyOfChart', () => {
  it('finds the key whose chords the chart uses', () => {
    expect(keyOfChart(bars('G D Em C'))).toEqual({ tonic: 7, mode: 'major' })
  })

  it('hears a minor key from a chart that starts and ends on its home chord', () => {
    expect(keyOfChart(bars('Am F C G Am'))).toEqual({ tonic: 9, mode: 'minor' })
  })

  it('counts sevenths as the chords they colour', () => {
    expect(keyOfChart(bars('Cmaj7 Dm7 G7 C'))).toEqual({ tonic: 0, mode: 'major' })
  })

  it('has no key for an empty chart', () => {
    expect(keyOfChart([[], []])).toBeNull()
  })
})
