import { describe, expect, it } from 'vitest'
import type { SongLyrics } from '../../state/lyrics/lyrics'
import {
  DEFAULT_LYRICS_STYLE,
  LYRICS_SIZES,
  MARGIN,
  VIDEO_HEIGHT,
  VIDEO_WIDTH,
  layoutLyrics
} from './videoFrame'

/** A canvas stand-in where every letter is half as wide as the font is tall. */
const fakeCanvas = () => {
  const ctx = {
    font: '',
    measureText: (text: string) => ({
      width: (text.length * parseFloat(ctx.font.split(' ')[1])) / 2
    })
  }
  return ctx as unknown as CanvasRenderingContext2D
}

const lyricsOf = (sung: string, next: string): SongLyrics => ({
  title: 'Song',
  offsetSec: 0,
  lines: [
    { time: 0, text: sung },
    { time: 5, text: next }
  ]
})

describe('layoutLyrics', () => {
  it('covers the sung line and the next together', () => {
    const layout = layoutLyrics(fakeCanvas(), lyricsOf('Hello', 'There'), DEFAULT_LYRICS_STYLE, 1)
    const [sung, next] = layout.blocks
    expect(sung.lines).toEqual(['Hello'])
    expect(next.top).toBeGreaterThan(sung.top)
    expect(layout.top + layout.height).toBeGreaterThan(next.top)
  })

  it('rises to keep long lines in large letters inside the frame', () => {
    const long = 'so many words that this line wraps over and over again'
    const size = LYRICS_SIZES[LYRICS_SIZES.length - 1]
    const style = { ...DEFAULT_LYRICS_STYLE, size }
    const layout = layoutLyrics(fakeCanvas(), lyricsOf(long, long), style, 1)
    expect(layout.top + layout.height).toBeLessThanOrEqual(VIDEO_HEIGHT - MARGIN)
  })

  it('keeps left-aligned lyrics on one left edge whatever the line', () => {
    const style = { ...DEFAULT_LYRICS_STYLE, align: 'left' as const, position: { x: 0.2, y: 0.5 } }
    const short = layoutLyrics(fakeCanvas(), lyricsOf('Hi', 'Yo'), style, 1)
    const long = layoutLyrics(fakeCanvas(), lyricsOf('A much longer line', 'Yo'), style, 1)
    expect(short.anchor).toBe(0.2 * VIDEO_WIDTH)
    expect(long.anchor).toBe(short.anchor)
    expect(long.x - long.width / 2).toBe(short.anchor)
  })
})
