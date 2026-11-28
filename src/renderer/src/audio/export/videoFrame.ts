import type { SongLyrics } from '../../state/lyrics/lyrics'
import { DEFAULT_FONT, FontId, fontFamilyOf } from './videoFonts'
import {
  Align,
  Position,
  Edges,
  anchorOf,
  anchoredColumn,
  blockCentre,
  coverCrop,
  inkFor,
  lineAnchor,
  lyricsAt,
  moveEdge,
  placeBlock,
  wrapText
} from './videoLayout'

/** Portrait 1080p: what Reels, Shorts, TikTok and Stories all take full-screen. */
export const VIDEO_WIDTH = 1080
export const VIDEO_HEIGHT = 1920

/**
 * The blank backgrounds on offer. Canvas can't read CSS tokens per theme, and a video
 * shouldn't change with the app's theme anyway, so these are the logo's golden-hour
 * colours as data. `ink` is the text colour that reads on each.
 */
export const BACKGROUNDS = {
  goldenHour: { top: '#ffe0a3', bottom: '#f6a646', ink: '#4a2c06' },
  sunset: { top: '#e8664a', bottom: '#8f3a2e', ink: '#fffaf2' },
  evening: { top: '#3b3936', bottom: '#1a1918', ink: '#fffaf2' },
  cream: { top: '#fffaf2', bottom: '#f3e9da', ink: '#2a211b' },
  // Plain black on request: the app avoids pure black, but a video may want it, and it
  // makes a photo-free video look clean on a dark phone screen.
  black: { top: '#000000', bottom: '#000000', ink: '#fffaf2' }
} as const
export type BackgroundId = keyof typeof BACKGROUNDS
export const BACKGROUND_IDS = Object.keys(BACKGROUNDS) as BackgroundId[]

/** What the colour picker starts on before the singer picks: a dusky evening blue. */
export const FIRST_PICKED_COLOUR = '#4f6d8f'

/** Where new words go from the add button: centred, near the top. */
export const DEFAULT_TEXT_POSITION: Position = { x: 0.5, y: 1 / 6 }

type PlainBackground = { kind: 'blank'; id: BackgroundId } | { kind: 'colour'; colour: string }

/** One set of words the singer placed on the picture. */
export interface TextBox {
  id: string
  /** May run over several lines; the singer's line breaks are kept. */
  text: string
  /** "#rrggbb", or null for whichever of dark or light reads on the background. */
  colour: string | null
  /** Letter size in video pixels, one of WORDS_SIZES. */
  size: number
  font: FontId
  align: Align
  /** The centre of the words on the frame. */
  position: Position
  /** How wide the lines may run before they wrap, in video pixels; null fits the words. */
  width: number | null
}

/** How the lyrics look and where they sit. */
export interface LyricsStyle {
  font: FontId
  /** Letter size of the sung line in video pixels, one of LYRICS_SIZES. */
  size: number
  align: Align
  /**
   * Where the lyrics hang from: `x` is their aligned edge (the left of left-aligned
   * lyrics, the middle of centred ones), so it stays still as lines change; `y` is their
   * top.
   */
  position: Position
  /** How wide the lines may run before they wrap, in video pixels; null fits the frame. */
  width: number | null
}

/** What the singer chose for the video's picture, as the export dialog hands it over. */
export interface VideoOptions {
  background: PlainBackground | { kind: 'picture'; file: File }
  texts: TextBox[]
  lyrics: boolean
  lyricsStyle: LyricsStyle
}

/** Everything needed to draw a frame: the picture decoded, the lyrics only if shown. */
export interface VideoScene {
  background: PlainBackground | { kind: 'picture'; image: ImageBitmap }
  texts: TextBox[]
  lyrics: SongLyrics | null
  lyricsStyle: LyricsStyle
}

/** Where a set of words lands on the frame, in video pixels. */
export interface WordsLayout {
  lines: string[]
  /** The centre of the lines. */
  x: number
  top: number
  width: number
  height: number
  lineHeight: number
  /**
   * How far the canvas draws these words below where a text field would set them: the
   * field centres the font's whole line box, the canvas centres its capitals.
   */
  nudge: number
}

// Text on a photo is cream with a soft shadow, and the lyrics sit over a soft shade, so
// they read on any picture. On a colour, it's warm brown or cream, whichever reads.
const LIGHT_INK = '#fffaf2'
const DARK_INK = '#2a211b'
const SHADE = 'rgba(20, 14, 8, 0.5)'
const CLEAR = 'rgba(20, 14, 8, 0)'
// How far the lyrics' shade reaches up from the bottom.
const SHADE_BOTTOM = 0.45
const SHADOW_BLUR = 18

// Sizes in video pixels; a phone shows the frame about a third this size.
export const MARGIN = 120
export const WORDS_SIZE = 72
/** The sizes words step through: a small credit line up to a big title. */
export const WORDS_SIZES = [40, 56, 72, 96, 128] as const
/** The sizes the sung line steps through; the next line is set smaller in proportion. */
export const LYRICS_SIZES = [48, 56, 64, 80, 96] as const
const NEXT_LYRIC_SCALE = 0.7
// The gap between the sung line and the next, as a share of the sung line's size.
const NEXT_LYRIC_GAP_SCALE = 0.55
const LYRICS_TOP = 1300
// The narrowest the lyrics' lines may get when they're moved near an edge.
const LYRICS_MIN_WIDTH = 360
// The narrowest words may be sized to: room for a short word in the smallest size.
const WORDS_MIN_WIDTH = 160
const FRAME = { width: VIDEO_WIDTH, height: VIDEO_HEIGHT, margin: MARGIN }

/** Lyrics start centred under the middle of the picture, in the app's own font. */
export const DEFAULT_LYRICS_STYLE: LyricsStyle = {
  font: DEFAULT_FONT,
  size: 64,
  align: 'center',
  position: { x: 0.5, y: LYRICS_TOP / VIDEO_HEIGHT },
  width: null
}

/** Where lyrics lined up `align` start: against that margin, or the middle. */
export function lyricsEdge(align: Align): number {
  if (align === 'left') return MARGIN / VIDEO_WIDTH
  if (align === 'right') return (VIDEO_WIDTH - MARGIN) / VIDEO_WIDTH
  return 0.5
}
export const LINE_HEIGHT = 1.25
const NEXT_LYRIC_ALPHA = 0.65
export const WEIGHT_WORDS = 700
const WEIGHT_LYRIC = 600

/**
 * Where a line's baseline goes, below the top of its slot, so its capitals sit in the
 * middle. Fonts put their letters at very different heights in their em box (a
 * handwriting font leaves room for long tails), so drawing from the top would set some
 * high and some low. Uses the font already set on `ctx`.
 */
function baselineIn(ctx: CanvasRenderingContext2D, lineHeight: number): number {
  const capital = ctx.measureText(CAPITAL).actualBoundingBoxAscent
  return (lineHeight + capital) / 2
}
// A capital's height is what reads as the middle of a line, with or without descenders.
const CAPITAL = 'H'

/** Fills `lines` lined up `align` on `x`, each in its own slot of `lineHeight` from `top`. */
function fillLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  top: number,
  lineHeight: number,
  align: Align
): void {
  ctx.textAlign = align
  const baseline = baselineIn(ctx, lineHeight)
  lines.forEach((line, i) => ctx.fillText(line, x, top + i * lineHeight + baseline))
}

/** Where a set of words lands: centred where the singer put it, kept inside the frame. */
export function layoutWords(ctx: CanvasRenderingContext2D, box: TextBox): WordsLayout | null {
  ctx.font = wordsFont(box)
  const measure = (s: string): number => ctx.measureText(s).width
  const lines = wrapText(box.text, box.width ?? VIDEO_WIDTH - MARGIN * 2, measure)
  if (!lines.length) return null
  const lineHeight = box.size * LINE_HEIGHT
  // A width the singer set is the box they sized; otherwise the box hugs the lines.
  const width = box.width ?? Math.max(...lines.map(measure))
  const height = lines.length * lineHeight
  const { x, top } = placeBlock(box.position, width, height, FRAME)
  const metrics = ctx.measureText(CAPITAL)
  // Where a text field puts the baseline: half the spare line height above the font's box.
  const fieldBaseline =
    (lineHeight + metrics.fontBoundingBoxAscent - metrics.fontBoundingBoxDescent) / 2
  const nudge = baselineIn(ctx, lineHeight) - fieldBaseline
  return { lines, x, top, width, height, lineHeight, nudge }
}

const wordsFont = (box: TextBox): string =>
  `${WEIGHT_WORDS} ${box.size}px ${fontFamilyOf(box.font)}`

/** Draws each set of words the singer placed. */
function drawWords(ctx: CanvasRenderingContext2D, scene: VideoScene, skip?: string): void {
  const onPicture = scene.background.kind === 'picture'
  for (const box of scene.texts) {
    if (box.id === skip) continue
    const layout = layoutWords(ctx, box)
    if (!layout) continue
    ctx.fillStyle = box.colour ?? inkOn(scene.background)
    // A soft shadow keeps words readable wherever they sit on a photo.
    ctx.shadowColor = SHADE
    ctx.shadowBlur = onPicture ? SHADOW_BLUR : 0
    const x = lineAnchor(layout.x, layout.width, box.align)
    fillLines(ctx, layout.lines, x, layout.top, layout.lineHeight, box.align)
  }
  ctx.shadowBlur = 0
}

/** One run of lyric lines in one size: the sung line, or the next. */
interface LyricBlock {
  lines: string[]
  size: number
  top: number
}

/** Where the lyrics land: the sung line and the next, and the area they cover together. */
export interface LyricsLayout {
  blocks: [LyricBlock, LyricBlock]
  /** Where the lines are drawn from, lined up by the style's `align`. */
  anchor: number
  /** The centre of the area. */
  x: number
  top: number
  width: number
  height: number
}

const lyricFont = (size: number, font: FontId): string =>
  `${WEIGHT_LYRIC} ${size}px ${fontFamilyOf(font)}`

/** Wraps the lyrics at `timeSec` as the video draws them, measured in their font. */
export function layoutLyrics(
  ctx: CanvasRenderingContext2D,
  lyrics: SongLyrics,
  style: LyricsStyle,
  timeSec: number
): LyricsLayout {
  const { current, next } = lyricsAt(lyrics, timeSec)
  const { anchor, wrapWidth } = lyricsColumn(style)
  const start = Math.max(MARGIN, style.position.y * VIDEO_HEIGHT)
  let top = start
  let width = 0
  const block = (text: string, size: number): LyricBlock => {
    ctx.font = lyricFont(size, style.font)
    const measure = (line: string): number => ctx.measureText(line).width
    const lines = wrapText(text, wrapWidth, measure)
    width = Math.max(width, ...lines.map(measure))
    const placed = { lines, size, top }
    top += lines.length * size * LINE_HEIGHT
    return placed
  }
  const sung = block(current, style.size)
  top += style.size * NEXT_LYRIC_GAP_SCALE
  const following = block(next, style.size * NEXT_LYRIC_SCALE)
  const height = top - start
  // Long lines in large letters, or lyrics dragged low, rise just enough to stay clear of
  // the bottom edge.
  const lift = Math.max(0, start + height - (VIDEO_HEIGHT - MARGIN))
  sung.top -= lift
  following.top -= lift
  // A width the singer set is the box they sized; otherwise the box hugs the lines.
  const boxWidth = style.width === null ? width : wrapWidth
  const x = blockCentre(anchor, boxWidth, style.align)
  return { blocks: [sung, following], anchor, x, top: start - lift, width: boxWidth, height }
}

/** The lyrics' position, kept where their lines still have room inside the margins. */
export function clampLyrics(style: LyricsStyle): Position {
  return { x: lyricsColumn(style).anchor / VIDEO_WIDTH, y: style.position.y }
}

function lyricsColumn(style: LyricsStyle): { anchor: number; wrapWidth: number } {
  const { width } = style
  const column = anchoredColumn(
    style.position.x * VIDEO_WIDTH,
    style.align,
    FRAME,
    width ?? LYRICS_MIN_WIDTH
  )
  return width === null ? column : { ...column, wrapWidth: Math.min(width, column.wrapWidth) }
}

/** Words with one side of their box dragged to `to` (video pixels); `edges` is the box now. */
export function resizeWords(
  box: TextBox,
  edges: Edges,
  side: 'left' | 'right',
  to: number
): Pick<TextBox, 'position' | 'width'> {
  const moved = moveEdge(edges, side, to, FRAME, WORDS_MIN_WIDTH)
  return {
    position: { ...box.position, x: (moved.left + moved.right) / 2 / VIDEO_WIDTH },
    width: moved.right - moved.left
  }
}

/**
 * The lyrics fitting the frame again: as wide as they can run, from their alignment's
 * home (that margin, or the middle), at the height they're at.
 */
export function fitLyrics(style: LyricsStyle): Pick<LyricsStyle, 'position' | 'width'> {
  return { position: { ...style.position, x: lyricsEdge(style.align) }, width: null }
}

/** The lyrics with one side of their box dragged to `to` (video pixels); `edges` is the box now. */
export function resizeLyrics(
  style: LyricsStyle,
  edges: Edges,
  side: 'left' | 'right',
  to: number
): Pick<LyricsStyle, 'position' | 'width'> {
  const moved = moveEdge(edges, side, to, FRAME, LYRICS_MIN_WIDTH)
  return {
    position: { ...style.position, x: anchorOf(moved, style.align) / VIDEO_WIDTH },
    width: moved.right - moved.left
  }
}

function drawBackground(ctx: CanvasRenderingContext2D, scene: VideoScene): void {
  if (scene.background.kind === 'picture') {
    const { image } = scene.background
    const crop = coverCrop(image.width, image.height, VIDEO_WIDTH, VIDEO_HEIGHT)
    ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, VIDEO_WIDTH, VIDEO_HEIGHT)
    return
  }
  if (scene.background.kind === 'colour') {
    ctx.fillStyle = scene.background.colour
    ctx.fillRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT)
    return
  }
  const colours = BACKGROUNDS[scene.background.id]
  const fill = ctx.createLinearGradient(0, 0, 0, VIDEO_HEIGHT)
  fill.addColorStop(0, colours.top)
  fill.addColorStop(1, colours.bottom)
  ctx.fillStyle = fill
  ctx.fillRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT)
}

function drawShade(ctx: CanvasRenderingContext2D, from: number, to: number): void {
  const fill = ctx.createLinearGradient(0, from, 0, to)
  fill.addColorStop(0, SHADE)
  fill.addColorStop(1, CLEAR)
  ctx.fillStyle = fill
  ctx.fillRect(0, Math.min(from, to), VIDEO_WIDTH, Math.abs(to - from))
}

/** Draws the video's frame at `timeSec`: the picture, the singer's words, and the lyrics. */
export function drawVideoFrame(
  ctx: CanvasRenderingContext2D,
  scene: VideoScene,
  timeSec: number,
  /** Words to leave out: the editor shows the ones being typed as a text field instead. */
  skipText?: string
): void {
  drawBackground(ctx, scene)
  const onPicture = scene.background.kind === 'picture'
  if (onPicture && scene.lyrics) {
    drawShade(ctx, VIDEO_HEIGHT, VIDEO_HEIGHT * (1 - SHADE_BOTTOM))
  }

  ctx.textBaseline = 'alphabetic'
  drawWords(ctx, scene, skipText)
  if (!scene.lyrics) return
  ctx.fillStyle = inkOn(scene.background)
  const style = scene.lyricsStyle
  const { blocks, anchor } = layoutLyrics(ctx, scene.lyrics, style, timeSec)
  blocks.forEach((block, i) => {
    // The next line is fainter, so the sung one leads.
    ctx.globalAlpha = i ? NEXT_LYRIC_ALPHA : 1
    ctx.font = lyricFont(block.size, style.font)
    fillLines(ctx, block.lines, anchor, block.top, block.size * LINE_HEIGHT, style.align)
  })
  ctx.globalAlpha = 1
}

/**
 * Roughly where lyrics sit when they can't be measured (in tests): a line of each size,
 * as wide as they may run.
 */
export function lyricsArea(style: LyricsStyle): {
  x: number
  top: number
  width: number
  height: number
} {
  const { anchor, wrapWidth } = lyricsColumn(style)
  const { size } = style
  return {
    x: blockCentre(anchor, wrapWidth, style.align),
    top: style.position.y * VIDEO_HEIGHT,
    width: wrapWidth,
    height: size * (1 + NEXT_LYRIC_SCALE) * LINE_HEIGHT + size * NEXT_LYRIC_GAP_SCALE
  }
}

/** The text colour that reads on a background, when the singer hasn't picked one. */
export function inkOn(background: VideoScene['background']): string {
  if (background.kind === 'picture') return LIGHT_INK
  if (background.kind === 'blank') return BACKGROUNDS[background.id].ink
  return inkFor(background.colour) === 'dark' ? DARK_INK : LIGHT_INK
}

/** A key that changes only when the frame would look different, so unchanged frames skip drawing. */
export function frameKey(scene: VideoScene, timeSec: number): string {
  if (!scene.lyrics) return ''
  const { current, next } = lyricsAt(scene.lyrics, timeSec)
  return `${current}\n${next}`
}
