import { describe, expect, it } from 'vitest'
import { chartFromText, chordsMatching, parseChord } from './chordText'
import { chordName } from './noteNames'

const names = (bars: ReturnType<typeof chartFromText>['bars']) =>
  bars.map((bar) => bar.map(chordName).join(' '))

describe('parseChord', () => {
  it('reads chords the way chord sheets write them', () => {
    expect(parseChord('Am')).toEqual({ root: 9, quality: 'minor' })
    expect(parseChord('F#7')).toEqual({ root: 6, quality: '7' })
    expect(parseChord('B♭maj7')).toEqual({ root: 10, quality: 'maj7' })
    expect(parseChord('Dsus')).toEqual({ root: 2, quality: 'sus4' })
    expect(parseChord('C/E')).toEqual({ root: 0, quality: 'major', bass: 4 })
  })

  it('tells major and minor sevenths apart by case', () => {
    expect(parseChord('CM7')?.quality).toBe('maj7')
    expect(parseChord('Cm7')?.quality).toBe('m7')
  })

  it('refuses anything that is not a chord', () => {
    for (const text of ['', 'H', 'Cadd13', 'C/X', 'C/E/G', 'hello']) {
      expect(parseChord(text)).toBeNull()
    }
  })
})

describe('chartFromText', () => {
  it('reads one chord per bar from a plain list', () => {
    expect(names(chartFromText('C G\nAm  F').bars)).toEqual(['C', 'G', 'Am', 'F'])
  })

  it('reads bars between lines, with chords in a bar sharing it', () => {
    expect(names(chartFromText('| C | F G | % | Am |').bars)).toEqual(['C', 'F G', '', 'Am'])
  })

  it('lists what it could not read and leaves that bar carrying on', () => {
    const { bars, unread } = chartFromText('C Hm G')
    expect(names(bars)).toEqual(['C', '', 'G'])
    expect(unread).toEqual(['Hm'])
  })
})

describe('chordsMatching', () => {
  it('finds the chord typed first, then the ones its name starts with', () => {
    expect(chordsMatching('G', 3).map(chordName)).toEqual(['G', 'Gm', 'G7'])
    expect(chordsMatching('Db7', 1).map(chordName)).toEqual(['C♯7'])
  })
})
