import { describe, expect, it } from 'vitest'
import { Chord } from '../../audio/music/chords'
import {
  chordBefore,
  clearBars,
  copyBars,
  fillBars,
  insertBars,
  keepAt,
  pasteBars,
  removeBars,
  repeatLine,
  splitBar,
  swapBars,
  tapTempo,
  transposeBars,
  withChordAt
} from './chartBars'
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

  it('moves every chord, slash bass and all, into a new key', () => {
    expect(names(transposeBars(bars('| C | F/A G7 | % | Bm |'), 2))).toEqual([
      'D',
      'G/B A7',
      '',
      'C♯m'
    ])
    expect(names(transposeBars(bars('| C | Am |'), -1))).toEqual(['B', 'A♭m'])
  })

  it('fills, clears and removes a run of bars', () => {
    const chart = bars('| C | F Am | Dm | E |')
    expect(names(fillBars(chart, 1, 2, G))).toEqual(['C', 'G', 'G', 'E'])
    expect(names(clearBars(chart, 1, 2))).toEqual(['C', '', '', 'E'])
    expect(names(removeBars(chart, 1, 2, []))).toEqual(['C', 'E'])
    expect(removeBars(chart, 0, 3, [])).toEqual([[]])
  })

  it('copies a run of bars and pastes it over the chart from another bar', () => {
    const chart = bars('| C | G | Am | F |')
    const copied = copyBars(chart, 0, 1)
    expect(names(pasteBars(chart, 3, copied))).toEqual(['C', 'G', 'Am', 'C', 'G'])
  })

  it('puts pasted bars in, moving the rest along', () => {
    expect(names(insertBars(bars('| C | G | F |'), 2, bars('| Am | Dm |')))).toEqual([
      'C',
      'G',
      'Am',
      'Dm',
      'F'
    ])
  })

  it('repeats the line a bar is on, right after it', () => {
    const { bars: next, copyAt } = repeatLine(bars('| C | G | Am | F | D |'), 1, 4)
    expect(names(next)).toEqual(['C', 'G', 'Am', 'F', 'C', 'G', 'Am', 'F', 'D'])
    expect(copyAt).toBe(4)
  })

  it('merges a split bar whose halves end up the same', () => {
    expect(names(withChordAt(bars('| C G |'), 0, 1, { root: 0, quality: 'major' }))).toEqual(['C'])
  })

  it('lets one half of a split bar keep the chord before it', () => {
    expect(names(keepAt(bars('| C G |'), 0, 1)!)).toEqual(['C'])
    expect(names(keepAt(bars('| F | C G |'), 1, 0)!)).toEqual(['F', 'F G'])
    expect(keepAt(bars('| C G |'), 0, 0)).toBeUndefined()
  })

  it('swaps two bars', () => {
    expect(names(swapBars(bars('| C | F Am | Dm |'), 0, 2))).toEqual(['Dm', 'F Am', 'C'])
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
