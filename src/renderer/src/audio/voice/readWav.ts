// Reads Rove's own takes (16-bit PCM WAV, written by audio/encode/wav.ts) without Web
// Audio, so a Worker can decode them. Chunks are walked rather than assuming the
// canonical 44-byte header, so a file with extra chunks (LIST, fact) still reads.
// http://soundfile.sapp.org/doc/WaveFormat/
import { PCM_FORMAT } from '../encode/constants'
import {
  BITS,
  BYTES_PER_SAMPLE,
  CHUNK_HEADER_BYTES,
  FULL_SCALE,
  RIFF_HEADER_BYTES
} from './constants'

export interface DecodedWav {
  /** Mixed to mono. */
  samples: Float32Array
  sampleRate: number
}

export function readWav(bytes: Uint8Array): DecodedWav {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const tag = (at: number): string =>
    String.fromCharCode(...bytes.subarray(at, Math.min(bytes.length, at + 4)))
  if (bytes.length < RIFF_HEADER_BYTES || tag(0) !== 'RIFF' || tag(8) !== 'WAVE') {
    throw new Error('Not a WAV file')
  }

  let format: { channels: number; sampleRate: number } | null = null
  for (let at = RIFF_HEADER_BYTES; at + CHUNK_HEADER_BYTES <= bytes.length;) {
    const id = tag(at)
    const size = view.getUint32(at + 4, true)
    const body = at + CHUNK_HEADER_BYTES
    if (id === 'fmt ') {
      if (view.getUint16(body, true) !== PCM_FORMAT || view.getUint16(body + 14, true) !== BITS) {
        throw new Error('Not a 16-bit PCM WAV file')
      }
      format = {
        channels: view.getUint16(body + 2, true),
        sampleRate: view.getUint32(body + 4, true)
      }
    } else if (id === 'data') {
      if (!format) throw new Error('WAV data before its format')
      // A take cut short by a crash may claim more data than the file holds.
      const end = Math.min(bytes.length, body + size)
      return { samples: toMono(view, body, end, format.channels), sampleRate: format.sampleRate }
    }
    // Chunks are padded to an even length.
    at = body + size + (size % 2)
  }
  throw new Error('WAV file has no audio')
}

function toMono(view: DataView, start: number, end: number, channels: number): Float32Array {
  const frameBytes = BYTES_PER_SAMPLE * channels
  const samples = new Float32Array(Math.floor((end - start) / frameBytes))
  for (let i = 0; i < samples.length; i++) {
    let sum = 0
    for (let c = 0; c < channels; c++) {
      sum += view.getInt16(start + i * frameBytes + c * BYTES_PER_SAMPLE, true)
    }
    samples[i] = sum / channels / FULL_SCALE
  }
  return samples
}
