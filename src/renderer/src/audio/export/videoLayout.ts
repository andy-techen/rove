import { SongLyrics, activeLineIndex } from '../../state/lyrics/lyrics'
import { clamp } from '../dsp/units'
import { LIGHT_LUMINANCE, LUMA } from './constants'

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** The part of a picture that fills a frame of another shape, cropped evenly from the middle. */
export function coverCrop(
  sourceWidth: number,
  sourceHeight: number,
  frameWidth: number,
  frameHeight: number
): Rect {
  const scale = Math.min(sourceWidth / frameWidth, sourceHeight / frameHeight)
  const width = frameWidth * scale
  const height = frameHeight * scale
  return { x: (sourceWidth - width) / 2, y: (sourceHeight - height) / 2, width, height }
}

/**
 * Breaks text into lines no wider than `maxWidth`, between words. The singer's own line
 * breaks stay; a word too long for a line gets a line to itself rather than being cut.
 */
export function wrapText(
  text: string,
  maxWidth: number,
  measure: (text: string) => number
): string[] {
  const lines: string[] = []
  for (const paragraph of text.split(/\r?\n/)) {
    let line = ''
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const tried = line ? `${line} ${word}` : word
      if (line && measure(tried) > maxWidth) {
        lines.push(line)
        line = word
      } else {
        line = tried
      }
    }
    if (line) lines.push(line)
  }
  return lines
}

/**
 * What the video shows of the lyrics at a moment: the line being sung, and the next
 * line with words so the singer's audience can read ahead. A pause shows only what's next.
 */
export function lyricsAt(lyrics: SongLyrics, timeSec: number): { current: string; next: string } {
  const active = activeLineIndex(lyrics.lines, timeSec, lyrics.offsetSec)
  const current = active >= 0 ? lyrics.lines[active].text : ''
  const next = lyrics.lines.slice(active + 1).find((line) => line.text)?.text ?? ''
  return { current, next }
}

const HEX_CHANNELS = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i

/** Whether dark or light text reads better on a colour like "#336699". */
export function inkFor(colour: string): 'dark' | 'light' {
  const channels = colour.match(HEX_CHANNELS)?.slice(1) ?? ['0', '0', '0']
  const luminance = channels.reduce((sum, hex, i) => {
    // sRGB to linear light, per WCAG: https://www.w3.org/WAI/GL/wiki/Relative_luminance
    const c = parseInt(hex, 16) / 255
    const linear = c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    return sum + LUMA[i] * linear
  }, 0)
  return luminance > LIGHT_LUMINANCE ? 'dark' : 'light'
}

/** A point on the frame, as fractions of its width and height (0 to 1). */
export interface Position {
  x: number
  y: number
}

/**
 * Where to draw a block of text centred on `position`, kept inside the frame's margins so
 * moved words never run off the edge: the block's centre x and its top.
 */
export function placeBlock(
  position: Position,
  blockWidth: number,
  blockHeight: number,
  frame: { width: number; height: number; margin: number }
): { x: number; top: number } {
  // A block too big for the frame sits in the middle of where it could go.
  const fit = (value: number, min: number, max: number): number =>
    min > max ? (min + max) / 2 : clamp(value, min, max)
  const { width, height, margin } = frame
  return {
    x: fit(position.x * width, margin + blockWidth / 2, width - margin - blockWidth / 2),
    top: fit(position.y * height - blockHeight / 2, margin, height - margin - blockHeight)
  }
}

/** A set of words on the frame: its centre x, top and size, in video pixels. */
export interface Box {
  x: number
  top: number
  width: number
  height: number
}

/** The lines words were pulled onto, to draw while dragging; null where none holds. */
export interface Guides {
  x: number | null
  y: number | null
}

/** The closest of `pairs` ([where the words' edge or centre is, the line it could meet]). */
function closest(
  pairs: [number, number][],
  threshold: number
): { by: number; line: number | null } {
  let best: { by: number; line: number | null } = { by: 0, line: null }
  for (const [at, line] of pairs) {
    const by = line - at
    if (Math.abs(by) <= threshold && (best.line === null || Math.abs(by) < Math.abs(best.by))) {
      best = { by, line }
    }
  }
  return best
}

/**
 * Smart guides, as design and story editors have them: words being dragged are pulled onto
 * the picture's centre lines, and onto the centres and edges of other words, when they come
 * within `threshold`; the centre lines win when both are in reach. Anywhere else they move
 * freely.
 */
export function alignTo(
  moving: Box,
  others: Box[],
  frame: { width: number; height: number },
  threshold: number
): { dx: number; dy: number; guides: Guides } {
  const edges = (b: Box): { left: number; right: number; middle: number; bottom: number } => ({
    left: b.x - b.width / 2,
    right: b.x + b.width / 2,
    middle: b.top + b.height / 2,
    bottom: b.top + b.height
  })
  const m = edges(moving)
  const across: [number, number][] = [[moving.x, frame.width / 2]]
  const down: [number, number][] = [[m.middle, frame.height / 2]]
  for (const other of others) {
    const o = edges(other)
    across.push([moving.x, other.x], [m.left, o.left], [m.right, o.right])
    down.push([m.middle, o.middle], [moving.top, other.top], [m.bottom, o.bottom])
  }
  // The picture's centre lines come first: they're where most words want to be.
  const centreFirst = (pairs: [number, number][]): { by: number; line: number | null } => {
    const centre = closest(pairs.slice(0, 1), threshold)
    return centre.line !== null ? centre : closest(pairs, threshold)
  }
  const x = centreFirst(across)
  const y = centreFirst(down)
  return { dx: x.by, dy: y.by, guides: { x: x.line, y: y.line } }
}

/** The next size up (`by` 1) or down (-1) from `size` in `sizes` (ascending), stopping at the ends. */
export function stepSize(size: number, sizes: readonly number[], by: 1 | -1): number {
  const nearest = sizes.reduce(
    (best, s, i) => (Math.abs(s - size) < Math.abs(sizes[best] - size) ? i : best),
    0
  )
  return sizes[Math.min(sizes.length - 1, Math.max(0, nearest + by))]
}

/** How a block's lines line up with each other. */
export const ALIGNS = ['left', 'center', 'right'] as const
export type Align = (typeof ALIGNS)[number]

/** The alignment after `align`, round to the first again: one button steps through them. */
export function nextAlign(align: Align): Align {
  return ALIGNS[(ALIGNS.indexOf(align) + 1) % ALIGNS.length]
}

/** Where lines are drawn from, for a block `width` wide centred on `x`. */
export function lineAnchor(x: number, width: number, align: Align): number {
  if (align === 'left') return x - width / 2
  if (align === 'right') return x + width / 2
  return x
}

/** The centre of a block `width` wide whose lines are drawn from `anchor`. */
export function blockCentre(anchor: number, width: number, align: Align): number {
  if (align === 'left') return anchor + width / 2
  if (align === 'right') return anchor - width / 2
  return anchor
}

/**
 * A column of text held by its aligned edge (left lines by their left edge, and so on), so
 * lines of different lengths keep that edge still. Keeps the edge where the column has at
 * least `minWidth` inside the margins, and says how wide its lines may run.
 */
export function anchoredColumn(
  x: number,
  align: Align,
  frame: { width: number; margin: number },
  minWidth: number
): { anchor: number; wrapWidth: number } {
  const { width, margin } = frame
  const clamp = (value: number, min: number, max: number): number =>
    Math.min(max, Math.max(min, value))
  if (align === 'left') {
    const anchor = clamp(x, margin, width - margin - minWidth)
    return { anchor, wrapWidth: width - margin - anchor }
  }
  if (align === 'right') {
    const anchor = clamp(x, margin + minWidth, width - margin)
    return { anchor, wrapWidth: anchor - margin }
  }
  const anchor = clamp(x, margin + minWidth / 2, width - margin - minWidth / 2)
  return { anchor, wrapWidth: 2 * Math.min(anchor - margin, width - margin - anchor) }
}

/** The left and right edges of a column of text, in video pixels. */
export interface Edges {
  left: number
  right: number
}

/** The edges of a column `width` wide whose lines are drawn from `anchor`. */
export function columnEdges(anchor: number, width: number, align: Align): Edges {
  const left = lineAnchor(blockCentre(anchor, width, align), width, 'left')
  return { left, right: left + width }
}

/** Where a column's lines are drawn from, given its edges. */
export function anchorOf(edges: Edges, align: Align): number {
  const width = edges.right - edges.left
  return lineAnchor(edges.left + width / 2, width, align)
}

/**
 * A column with one `side` dragged to `to`: the other side stays still, and the column
 * stays inside the margins and at least `minWidth` wide.
 */
export function moveEdge(
  edges: Edges,
  side: 'left' | 'right',
  to: number,
  frame: { width: number; margin: number },
  minWidth: number
): Edges {
  if (side === 'right') {
    const right = Math.min(frame.width - frame.margin, Math.max(edges.left + minWidth, to))
    return { left: edges.left, right }
  }
  const left = Math.max(frame.margin, Math.min(edges.right - minWidth, to))
  return { left, right: edges.right }
}
