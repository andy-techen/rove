import { describe, expect, it } from 'vitest'
import { t } from '@shared/copy'
import {
  chartFromText,
  chordSheetToPaste,
  chordsMatching,
  parseChord,
  unreadNote
} from './chordText'
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
})

describe('chartFromText with a chord sheet from the web', () => {
  const sheet = (text: string) => names(chartFromText(text).bars)

  it('reads the chords above the lyrics, one bar each, skipping lyrics and headings', () => {
    const pasted = chartFromText(
      [
        '[Verse 1]',
        'G              Em',
        'I found a love for me',
        '',
        'C                  D',
        'Darling, just dive right in'
      ].join('\n')
    )
    expect(names(pasted.bars)).toEqual(['G', 'Em', 'C', 'D'])
    expect(pasted.unread).toEqual([])
  })

  it('reads a labelled line of chords and repeats it when marked', () => {
    expect(sheet('Intro: C G Am F\nChorus:\nF G (x2)')).toEqual([
      'C',
      'G',
      'Am',
      'F',
      'F',
      'G',
      'F',
      'G'
    ])
  })

  it('reads chords written inside the lyrics in brackets', () => {
    expect(sheet('[C]Let it be, let it [G]be\nLet it [Am]be, let it [F]be')).toEqual([
      'C',
      'G',
      'Am',
      'F'
    ])
  })

  it('plays richer chords as the nearest one Rove knows', () => {
    expect(sheet('Cadd9  G/B  Em7b5\nD9  Fmaj9  Asus2')).toEqual([
      'C',
      'G/B',
      'Edim',
      'D7',
      'Fmaj7',
      'Asus2'
    ])
  })

  it('reads chords in brackets, the way sheets mark a passing chord', () => {
    expect(sheet('C   (G)   Am\nsome words here\nF (C/E)')).toEqual(['C', 'G', 'Am', 'F', 'C/E'])
  })

  it('says which bar each chord it couldn’t read is in, leaving that bar carrying on', () => {
    const { bars, unread } = chartFromText('C   G\nla la la\nAm  Hm7#11  F')
    expect(names(bars)).toEqual(['C', 'G', 'Am', '', 'F'])
    expect(unread).toEqual([{ name: 'Hm7#11', bar: 3 }])
  })

  it('never takes a lyric that starts like a chord for chords', () => {
    expect(sheet('A whole new world\nC   G\nAm I wrong\nF')).toEqual(['C', 'G', 'F'])
  })
})

describe('chordSheetToPaste', () => {
  it('pastes chords copied from elsewhere', () => {
    expect(names(chordSheetToPaste('C G Am F', null)!.bars)).toEqual(['C', 'G', 'Am', 'F'])
  })

  it('leaves bars copied in Rove to paste when the clipboard has not changed since', () => {
    expect(chordSheetToPaste('C G Am F', 'C G Am F')).toBeNull()
  })

  it('leaves Paste alone when the clipboard holds no chords', () => {
    expect(chordSheetToPaste('Just some lyrics here', null)).toBeNull()
  })
})

describe('unreadNote', () => {
  const item = (name: string, bar: number) => t('chords.unreadItem', { name, bar })

  it('names each chord it couldn’t read with the bar it’s in, counting from where it pasted', () => {
    const note = unreadNote(
      [
        { name: 'Hm', bar: 0 },
        { name: 'X7', bar: 4 }
      ],
      2
    )
    expect(note).toBe(t('chords.unread', { list: [item('Hm', 3), item('X7', 7)].join(', ') }))
  })

  it('keeps a long list short', () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ name: 'Hm', bar: i }))
    expect(unreadNote(many, 0)).toContain(t('chords.unreadMore', { n: 5 }))
  })

  it('says nothing when everything was read', () => {
    expect(unreadNote([], 0)).toBeNull()
  })
})

describe('chordsMatching', () => {
  it('finds the chord typed first, then the ones its name starts with', () => {
    expect(chordsMatching('G', 3).map(chordName)).toEqual(['G', 'Gm', 'G7'])
    expect(chordsMatching('Db7', 1).map(chordName)).toEqual(['C♯7'])
  })
})
