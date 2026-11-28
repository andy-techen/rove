import type { SongLyrics } from '../../state/lyrics/lyrics'
import { Position, coverCrop, inkFor, lyricsAt, placeBlock, wrapText } from './videoLayout'

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
  /** The centre of the words on the frame. */
  position: Position
}

/** What the singer chose for the video's picture, as the export dialog hands it over. */
export interface VideoOptions {
  background: PlainBackground | { kind: 'picture'; file: File }
  texts: TextBox[]
  lyrics: boolean
}

/** Everything needed to draw a frame: the picture decoded, the lyrics only if shown. */
export interface VideoScene {
  background: PlainBackground | { kind: 'picture'; image: ImageBitmap }
  texts: TextBox[]
  lyrics: SongLyrics | null
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
const LYRIC_SIZE = 64
const NEXT_LYRIC_SIZE = 44
const LYRICS_TOP = 1300
export const LINE_HEIGHT = 1.25
const NEXT_LYRIC_GAP = 36
const NEXT_LYRIC_ALPHA = 0.65
export const WEIGHT_WORDS = 700
const WEIGHT_LYRIC = 600
const FALLBACK_FONT = 'system-ui, sans-serif'

/** The app's own typeface, so the video looks like Rove made it. */
function fontFamily(): string {
  const family = getComputedStyle(document.documentElement).getPropertyValue('--font-family')
  return family.trim() || FALLBACK_FONT
}

/** Where a set of words lands: centred where the singer put it, kept inside the frame. */
export function layoutWords(ctx: CanvasRenderingContext2D, box: TextBox): WordsLayout | null {
  ctx.font = wordsFont(box.size)
  const measure = (s: string): number => ctx.measureText(s).width
  const lines = wrapText(box.text, VIDEO_WIDTH - MARGIN * 2, measure)
  if (!lines.length) return null
  const lineHeight = box.size * LINE_HEIGHT
  const width = Math.max(...lines.map(measure))
  const height = lines.length * lineHeight
  const frame = { width: VIDEO_WIDTH, height: VIDEO_HEIGHT, margin: MARGIN }
  const { x, top } = placeBlock(box.position, width, height, frame)
  return { lines, x, top, width, height, lineHeight }
}

const wordsFont = (size: number): string => `${WEIGHT_WORDS} ${size}px ${fontFamily()}`

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
    layout.lines.forEach((line, i) =>
      ctx.fillText(line, layout.x, layout.top + i * layout.lineHeight)
    )
  }
  ctx.shadowBlur = 0
}

/** Draws wrapped, centred lines from `top`; returns where the text ended. */
function drawLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  top: number,
  size: number,
  weight: number,
  family: string
): number {
  ctx.font = `${weight} ${size}px ${family}`
  const lines = wrapText(text, VIDEO_WIDTH - MARGIN * 2, (s) => ctx.measureText(s).width)
  lines.forEach((line, i) => ctx.fillText(line, VIDEO_WIDTH / 2, top + i * size * LINE_HEIGHT))
  return top + lines.length * size * LINE_HEIGHT
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

  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  drawWords(ctx, scene, skipText)
  if (!scene.lyrics) return
  const family = fontFamily()
  ctx.fillStyle = inkOn(scene.background)
  const { current, next } = lyricsAt(scene.lyrics, timeSec)
  const end = drawLines(ctx, current, LYRICS_TOP, LYRIC_SIZE, WEIGHT_LYRIC, family)
  ctx.globalAlpha = NEXT_LYRIC_ALPHA
  drawLines(ctx, next, end + NEXT_LYRIC_GAP, NEXT_LYRIC_SIZE, WEIGHT_LYRIC, family)
  ctx.globalAlpha = 1
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
