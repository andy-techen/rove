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
