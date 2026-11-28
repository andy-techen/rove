import { describe, expect, it } from 'vitest'
import type { SongLyrics } from '../../state/lyrics/lyrics'
import {
  ALIGNS,
  alignTo,
  anchorOf,
  columnEdges,
  moveEdge,
  anchoredColumn,
  blockCentre,
  coverCrop,
  inkFor,
  lineAnchor,
  lyricsAt,
  placeBlock,
  stepSize,
  wrapText
} from './videoLayout'

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
  it.each([
    [
      'the sides of a wide picture to fill a tall frame',
      2000,
      1000,
      9,
      16,
      [718.75, 0, 562.5, 1000]
    ],
    [
      'the top and bottom of a tall picture to fill a wide frame',
      1000,
      2000,
      16,
      9,
      [0, 718.75, 1000, 562.5]
    ]
  ])('crops %s', (_, width, height, frameWidth, frameHeight, [x, y, w, h]) => {
    expect(coverCrop(width, height, frameWidth, frameHeight)).toEqual({ x, y, width: w, height: h })
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
  it.each([
    ['the coming line before the first is sung', 0, 0, '', 'First line'],
    ['the line being sung and the next one with words', 0, 3, 'First line', 'Second line'],
    ['only the coming line during a pause', 0, 6, '', 'Second line'],
    ['the coming line when the timing nudge holds the first back', 2, 3, '', 'First line']
  ])('shows %s', (_, offsetSec, atSec, current, next) => {
    expect(lyricsAt(lyrics(offsetSec), atSec)).toEqual({ current, next })
  })
})

describe('inkFor', () => {
  it.each([
    ['#f7e8c0', 'dark'],
    ['#203040', 'light']
  ])('writes on %s in %s ink', (colour, ink) => {
    expect(inkFor(colour)).toBe(ink)
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

describe('anchoredColumn', () => {
  const frame = { width: 1000, margin: 100 }

  it('runs left-aligned lines from the edge to the right margin', () => {
    expect(anchoredColumn(300, 'left', frame, 200)).toEqual({ anchor: 300, wrapWidth: 600 })
  })

  it('runs right-aligned lines back to the left margin', () => {
    expect(anchoredColumn(900, 'right', frame, 200)).toEqual({ anchor: 900, wrapWidth: 800 })
  })

  it('gives centred lines as much room as the nearer margin allows on both sides', () => {
    expect(anchoredColumn(400, 'center', frame, 200)).toEqual({ anchor: 400, wrapWidth: 600 })
  })

  it('keeps room for the narrowest column near an edge', () => {
    expect(anchoredColumn(850, 'left', frame, 200)).toEqual({ anchor: 700, wrapWidth: 200 })
    expect(anchoredColumn(50, 'center', frame, 200)).toEqual({ anchor: 200, wrapWidth: 200 })
  })
})

describe('lineAnchor and blockCentre', () => {
  it('turn a block’s centre into where its lines start, and back', () => {
    for (const align of ALIGNS) {
      expect(blockCentre(lineAnchor(500, 200, align), 200, align)).toBe(500)
    }
    expect(lineAnchor(500, 200, 'left')).toBe(400)
    expect(lineAnchor(500, 200, 'right')).toBe(600)
  })
})

describe('moveEdge', () => {
  const frame = { width: 1000, margin: 100 }
  const column = { left: 300, right: 700 }

  it('moves one side and keeps the other still', () => {
    expect(moveEdge(column, 'right', 600, frame, 200)).toEqual({ left: 300, right: 600 })
    expect(moveEdge(column, 'left', 200, frame, 200)).toEqual({ left: 200, right: 700 })
  })

  it('stops at the margins and at the narrowest column', () => {
    expect(moveEdge(column, 'right', 950, frame, 200)).toEqual({ left: 300, right: 900 })
    expect(moveEdge(column, 'left', 650, frame, 200)).toEqual({ left: 500, right: 700 })
  })
})

describe('columnEdges and anchorOf', () => {
  it.each(ALIGNS)('turn a %s-aligned column’s anchor into its edges, and back', (align) => {
    const edges = columnEdges(500, 200, align)
    expect(edges.right - edges.left).toBe(200)
    expect(anchorOf(edges, align)).toBe(500)
  })
})
