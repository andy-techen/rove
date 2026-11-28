// Loudness to ITU-R BS.1770-4 / EBU R128, as streaming services measure it.
// https://www.itu.int/rec/R-REC-BS.1770
export const BLOCK_SEC = 0.4
// Blocks overlap by 75%, so a new one starts every 100 ms.
export const BLOCKS_PER_WINDOW = 4
export const ABSOLUTE_GATE_LUFS = -70
export const RELATIVE_GATE_LU = -10
// Offsets the K-weighting filter's gain at 1 kHz, so a 1 kHz tone reads its RMS level.
export const LOUDNESS_OFFSET = -0.691
// Never boost a mix more than this to reach the target: a near-silent song would
// otherwise come out as amplified hiss.
export const MAX_BOOST_DB = 20

// The mixdown
/**
 * Integrated loudness to aim for. Spotify, YouTube, Instagram and TikTok all turn songs
 * to about -14 LUFS, so a mix levelled there plays as mixed, and anything louder is only
 * turned down again.
 * https://support.spotify.com/us/artists/article/loudness-normalization/
 */
export const STREAMING_LUFS = -14
// Headroom for MP3 encoding and cheap converters, which overshoot a 0 dBFS peak.
export const PEAK_CEILING_DB = -1
export const STEREO = 2

// The video picture

/** Portrait 1080p: what Reels, Shorts, TikTok and Stories all take full-screen. */
export const VIDEO_WIDTH = 1080
export const VIDEO_HEIGHT = 1920
/** What the colour picker starts on before the singer picks: a dusky evening blue. */
export const FIRST_PICKED_COLOUR = '#4f6d8f'

// Text on a photo is cream with a soft shadow, and the lyrics sit over a soft shade, so
// they read on any picture. On a colour, it's warm brown or cream, whichever reads.
export const LIGHT_INK = '#fffaf2'
export const DARK_INK = '#2a211b'
export const SHADE = 'rgba(20, 14, 8, 0.5)'
export const CLEAR = 'rgba(20, 14, 8, 0)'
// How far the lyrics' shade reaches up from the bottom.
export const SHADE_BOTTOM = 0.45
export const SHADOW_BLUR = 18

// Sizes in video pixels; a phone shows the frame about a third this size.
export const MARGIN = 120
export const WORDS_SIZE = 72
/** The sizes words step through: a small credit line up to a big title. */
export const WORDS_SIZES = [40, 56, 72, 96, 128] as const
/** The sizes the sung line steps through; the next line is set smaller in proportion. */
export const LYRICS_SIZES = [48, 56, 64, 80, 96] as const
export const NEXT_LYRIC_SCALE = 0.7
// The gap between the sung line and the next, as a share of the sung line's size.
export const NEXT_LYRIC_GAP_SCALE = 0.55
export const LYRICS_TOP = 1300
// The narrowest the lyrics' lines may get when they're moved near an edge.
export const LYRICS_MIN_WIDTH = 360
// The narrowest words may be sized to: room for a short word in the smallest size.
export const WORDS_MIN_WIDTH = 160
export const FRAME = { width: VIDEO_WIDTH, height: VIDEO_HEIGHT, margin: MARGIN }

// How lines are set: spacing as a share of the size, the next lyric faded, and weights.
export const LINE_HEIGHT = 1.25
export const NEXT_LYRIC_ALPHA = 0.65
export const WEIGHT_WORDS = 700
export const WEIGHT_LYRIC = 600

// Text colour on a picked colour

// Relative luminance above which dark text reads better than light (WCAG's crossover).
export const LIGHT_LUMINANCE = 0.18
// How much red, green and blue each add to brightness (Rec. 709).
export const LUMA = [0.2126, 0.7152, 0.0722]
