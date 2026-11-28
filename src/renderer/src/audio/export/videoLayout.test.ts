import { describe, expect, it } from 'vitest'
import type { SongLyrics } from '../../state/lyrics/lyrics'
import { alignTo, coverCrop, inkFor, lyricsAt, placeBlock, stepSize, wrapText } from './videoLayout'

// Every character is 10 units wide, so widths are easy to reason about.
const measure = (text: string): number => text.length * 10

const lyrics = (offsetSec = 0): SongLyrics => ({
  title: 'Song',
  offsetSec,
  lines: [
    { time: 2, text: 'First line' },
    { time: 5, text: '' },
    { time: 8, text: 'Second line' }
  ]
})

describe('coverCrop', () => {
  it('crops the sides of a wide picture to fill a tall frame', () => {
    expect(coverCrop(2000, 1000, 9, 16)).toEqual({ x: 718.75, y: 0, width: 562.5, height: 1000 })
  })

  it('crops the top and bottom of a tall picture to fill a wide frame', () => {
    expect(coverCrop(1000, 2000, 16, 9)).toEqual({ x: 0, y: 718.75, width: 1000, height: 562.5 })
  })
})

describe('wrapText', () => {
  it('breaks between words to fit the width', () => {
    expect(wrapText('sing it out loud', 100, measure)).toEqual(['sing it', 'out loud'])
  })

  it('keeps a word longer than the width on a line of its own', () => {
    expect(wrapText('a supercalifragilistic day', 100, measure)).toEqual([
      'a',
      'supercalifragilistic',
      'day'
    ])
  })

  it('keeps the singer’s own line breaks', () => {
    expect(wrapText('one\ntwo', 1000, measure)).toEqual(['one', 'two'])
  })

  it('has no lines for blank text', () => {
    expect(wrapText('   ', 100, measure)).toEqual([])
  })
})

describe('lyricsAt', () => {
  it('shows the coming line before the first is sung', () => {
    expect(lyricsAt(lyrics(), 0)).toEqual({ current: '', next: 'First line' })
  })

  it('shows the line being sung and the next one with words', () => {
    expect(lyricsAt(lyrics(), 3)).toEqual({ current: 'First line', next: 'Second line' })
  })

  it('shows only the coming line during a pause', () => {
    expect(lyricsAt(lyrics(), 6)).toEqual({ current: '', next: 'Second line' })
  })

  it('follows the timing nudge', () => {
    expect(lyricsAt(lyrics(2), 3)).toEqual({ current: '', next: 'First line' })
  })
})

describe('inkFor', () => {
  it('writes dark on a light colour', () => {
    expect(inkFor('#f7e8c0')).toBe('dark')
  })

  it('writes light on a dark colour', () => {
    expect(inkFor('#203040')).toBe('light')
  })
})

describe('placeBlock', () => {
  const frame = { width: 1000, height: 2000, margin: 50 }

  it('centres the block on the chosen point', () => {
    expect(placeBlock({ x: 0.5, y: 0.5 }, 200, 100, frame)).toEqual({ x: 500, top: 950 })
  })

  it('keeps the block inside the frame’s margins', () => {
    expect(placeBlock({ x: 0, y: 1 }, 200, 100, frame)).toEqual({ x: 150, top: 1850 })
  })

  it('centres a block too wide to move sideways', () => {
    expect(placeBlock({ x: 0.1, y: 0.5 }, 950, 100, frame).x).toBe(500)
  })
})

describe('alignTo', () => {
  const frame = { width: 1000, height: 2000 }
  const box = (x: number, top: number, width = 200, height = 100) => ({ x, top, width, height })

  it('pulls words onto the picture’s centre line when they’re close', () => {
    expect(alignTo(box(510, 300), [], frame, 20)).toEqual({
      dx: -10,
      dy: 0,
      guides: { x: 500, y: null }
    })
  })

  it('leaves words where they are when nothing is close', () => {
    expect(alignTo(box(300, 300), [], frame, 20)).toEqual({
      dx: 0,
      dy: 0,
      guides: { x: null, y: null }
    })
  })

  it('pulls words onto the picture’s middle, top to bottom', () => {
    expect(alignTo(box(300, 945), [], frame, 20)).toEqual({
      dx: 0,
      dy: 5,
      guides: { x: null, y: 1000 }
    })
  })

  it('lines words up with the left edge of other words', () => {
    const other = box(300, 1500)
    expect(alignTo(box(308, 300), [other], frame, 20).dx).toBe(-8)
  })

  it('prefers the picture’s centre to another set of words that’s a little closer', () => {
    const other = box(300, 1500, 400)
    // Its right edge (500) is closer to this one's right edge than the centre line is.
    expect(alignTo(box(496, 300, 8), [other], frame, 20).guides.x).toBe(500)
    expect(alignTo(box(490, 300, 200), [other], frame, 20)).toMatchObject({ dx: 10 })
  })

  it('lines words up with the top of other words', () => {
    const other = box(800, 600, 200, 300)
    expect(alignTo(box(200, 612), [other], frame, 20)).toMatchObject({
      dy: -12,
      guides: { y: 600 }
    })
  })
})

describe('stepSize', () => {
  const sizes = [40, 56, 72, 96]

  it('moves to the next size up or down', () => {
    expect(stepSize(72, sizes, 1)).toBe(96)
    expect(stepSize(72, sizes, -1)).toBe(56)
  })

  it('stays at the smallest and largest', () => {
    expect(stepSize(40, sizes, -1)).toBe(40)
    expect(stepSize(96, sizes, 1)).toBe(96)
  })

  it('steps from the nearest size when between them', () => {
    expect(stepSize(70, sizes, 1)).toBe(96)
  })
})
