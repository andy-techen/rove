import type { BitDepth } from './wav'

// WAV
// The format code for plain integer PCM, the only kind Rove writes or reads.
export const PCM_FORMAT = 1
export const BITS_PER_BYTE = 8
// The canonical 44-byte RIFF/WAVE header; encodeWav's offsets follow its layout.
// http://soundfile.sapp.org/doc/WaveFormat/
export const HEADER_BYTES = 44
export const FMT_CHUNK_BYTES = 16
// Largest positive and negative integer sample at each depth.
export const FULL_SCALE: Record<BitDepth, { positive: number; negative: number }> = {
  16: { positive: 0x7fff, negative: 0x8000 },
  24: { positive: 0x7fffff, negative: 0x800000 }
}

// MP3
// 320 kbps CBR: the top MP3 rate, so the smaller file costs as little quality as MP3 can.
export const MP3_KBPS = 320
// LAME works in 1152-sample frames; whole frames per chunk keep its buffers tidy.
export const MP3_FRAME = 1152
export const FRAMES_PER_CHUNK = 64
export const INT16_MAX = 0x7fff

// MP4
/**
 * Frames per second. The picture only changes when a lyric line does, but social apps
 * expect a normal frame rate; a constant 24 plays everywhere, and a still frame costs
 * almost nothing to encode.
 */
export const FRAME_RATE = 24
