import { clamp } from '../dsp/units'
import { PCM_FORMAT, BITS_PER_BYTE, HEADER_BYTES, FMT_CHUNK_BYTES, FULL_SCALE } from './constants'

// Takes are 16-bit mono; exports are 24-bit stereo for headroom in mastering.
export type BitDepth = 16 | 24

/** PCM WAV from one buffer per channel (interleaved on write); clamps to full scale. */
export function encodeWav(
  channels: Float32Array[],
  sampleRate: number,
  bitDepth: BitDepth = 16
): ArrayBuffer {
  const bytesPerSample = bitDepth / BITS_PER_BYTE
  const blockAlign = bytesPerSample * channels.length
  const frames = channels[0]?.length ?? 0
  const dataSize = frames * blockAlign
  const buffer = new ArrayBuffer(HEADER_BYTES + dataSize)
  const view = new DataView(buffer)

  const writeString = (offset: number, str: string): void => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }

  writeString(0, 'RIFF')
  view.setUint32(4, HEADER_BYTES - 8 + dataSize, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, FMT_CHUNK_BYTES, true)
  view.setUint16(20, PCM_FORMAT, true)
  view.setUint16(22, channels.length, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitDepth, true)
  writeString(36, 'data')
  view.setUint32(40, dataSize, true)

  const { positive, negative } = FULL_SCALE[bitDepth]
  let offset = HEADER_BYTES
  for (let i = 0; i < frames; i++) {
    for (const channel of channels) {
      const clamped = clamp(channel[i], -1, 1)
      const value = Math.trunc(clamped < 0 ? clamped * negative : clamped * positive)
      if (bitDepth === 16) {
        view.setInt16(offset, value, true)
      } else {
        // 24-bit little-endian: the low two bytes, then the signed high byte.
        view.setUint16(offset, value & 0xffff, true)
        view.setInt8(offset + 2, value >> 16)
      }
      offset += bytesPerSample
    }
  }
  return buffer
}

export function concatSamples(chunks: Float32Array[]): Float32Array<ArrayBuffer> {
  const out = new Float32Array(chunks.reduce((sum, c) => sum + c.length, 0))
  let offset = 0
  for (const c of chunks) {
    out.set(c, offset)
    offset += c.length
  }
  return out
}
