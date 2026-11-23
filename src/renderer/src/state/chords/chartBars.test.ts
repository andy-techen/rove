import { describe, expect, it } from 'vitest'
import { Chord } from '../../audio/music/chords'
import { chordBefore, pasteBars, splitBar, tapTempo, withChordAt } from './chartBars'
import { chartFromText } from './chordText'
import { chordName } from './noteNames'

const bars = (text: string) => chartFromText(text).bars
const names = (chart: Chord[][]) => chart.map((bar) => bar.map(chordName).join(' '))
const G: Chord = { root: 7, quality: 'major' }

describe('editing bars', () => {
  it('puts a picked chord in the bar, keeping its second half', () => {
    expect(names(withChordAt(bars('| C | F Am |'), 1, 0, G))).toEqual(['C', 'G Am'])
  })

  it('splits an empty bar from the chord it was carrying on', () => {
    expect(names(withChordAt(bars('| C | % |'), 1, 1, G))).toEqual(['C', 'C G'])
  })

  it('splits a bar into two halves of the same chord until one is picked', () => {
    expect(names(splitBar(bars('| C | Am |'), 1))).toEqual(['C', 'Am Am'])
  })

  it('finds the chord an empty bar carries on', () => {
    expect(chordName(chordBefore(bars('| C | F G | % | % |'), 3)!)).toBe('G')
  })

  it('writes pasted bars over the chart from where they land, growing it', () => {
    expect(names(pasteBars(bars('C G'), 1, bars('Am F D')))).toEqual(['C', 'Am', 'F', 'D'])
  })
})

describe('tapTempo', () => {
  it('reads the tempo from steady taps', () => {
    expect(tapTempo([10, 10.5, 11, 11.5])).toBe(120)
  })

  it('starts counting again after a pause', () => {
    expect(tapTempo([1, 1.5, 9, 10])).toBe(60)
    expect(tapTempo([1, 1.5, 9])).toBeNull()
  })
})
