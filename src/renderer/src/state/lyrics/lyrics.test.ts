import { describe, expect, it } from 'vitest'
import { activeLineIndex, lyricsFromResult, parseLyricsText, searchFromName } from './lyrics'

const LRC = `[ar:Singer]
[ti:Song]
[00:01.50] First line
[00:04.00][00:20.00] Chorus
[00:08.25]
[00:10.00] Last line`

describe('parseLyricsText', () => {
  it('reads timed lyrics in order, repeating lines with several times', () => {
    expect(parseLyricsText(LRC)).toEqual([
      { time: 1.5, text: 'First line' },
      { time: 4, text: 'Chorus' },
      { time: 8.25, text: '' },
      { time: 10, text: 'Last line' },
      { time: 20, text: 'Chorus' }
    ])
  })

  it('applies the file’s own offset, which moves lines earlier', () => {
    expect(parseLyricsText('[offset:+500]\n[00:02.00] Hi')).toEqual([{ time: 1.5, text: 'Hi' }])
  })

  it('reads plain words as lines without times, keeping verse breaks', () => {
    expect(parseLyricsText('One\nTwo\n\n\nThree\n')).toEqual([
      { time: null, text: 'One' },
      { time: null, text: 'Two' },
      { time: null, text: '' },
      { time: null, text: 'Three' }
    ])
  })
})

describe('activeLineIndex', () => {
  const lines = parseLyricsText(LRC)

  it('is the last line that has started', () => {
    expect(activeLineIndex(lines, 0, 0)).toBe(-1)
    expect(activeLineIndex(lines, 5, 0)).toBe(1)
    expect(activeLineIndex(lines, 99, 0)).toBe(4)
  })

  it('shifts with the timing nudge', () => {
    // Lines 1 s later: at 5 s the chorus (4 s + 1 s) has only just begun.
    expect(activeLineIndex(lines, 4.9, 1)).toBe(0)
  })

  it('has no line for lyrics without times', () => {
    expect(activeLineIndex(parseLyricsText('One\nTwo'), 5, 0)).toBe(-1)
  })
})

describe('song lyrics', () => {
  const result = {
    id: 7,
    title: 'Song',
    artist: 'Singer',
    album: 'Album',
    durationSec: 200,
    synced: '[00:01.00] Hi',
    plain: 'Hi'
  }

  it('prefers the timed version of a search result', () => {
    expect(lyricsFromResult(result)).toEqual({
      title: 'Song',
      artist: 'Singer',
      lines: [{ time: 1, text: 'Hi' }],
      offsetSec: 0
    })
  })

  it('falls back to the words alone', () => {
    expect(lyricsFromResult({ ...result, synced: null }).lines).toEqual([
      { time: null, text: 'Hi' }
    ])
  })
})

describe('searchFromName', () => {
  it('searches for the song by name, but not for an untitled one', () => {
    expect(searchFromName('Golden Hour')).toBe('Golden Hour')
    expect(searchFromName('Untitled Song 2')).toBe('')
  })
})
