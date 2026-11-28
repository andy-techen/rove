import { Mp3Encoder } from '@breezystack/lamejs'
import { clamp } from '../dsp/units'
import { MP3_KBPS, MP3_FRAME, FRAMES_PER_CHUNK, INT16_MAX } from './constants'

const toInt16 = (samples: Float32Array): Int16Array =>
  Int16Array.from(samples, (s) => clamp(s, -1, 1) * INT16_MAX)

/**
 * Encodes a mix to MP3 in chunks, yielding between them so the window stays responsive
 * through a long song. `onProgress` gets the fraction done.
 */
export async function encodeMp3(
  channels: Float32Array[],
  sampleRate: number,
  onProgress?: (fraction: number) => void
): Promise<Uint8Array<ArrayBuffer>> {
  const encoder = new Mp3Encoder(channels.length, sampleRate, MP3_KBPS)
  const frames = channels[0]?.length ?? 0
  const chunk = MP3_FRAME * FRAMES_PER_CHUNK
  const parts: Uint8Array[] = []
  for (let i = 0; i < frames; i += chunk) {
    const [left, right] = channels.map((c) => toInt16(c.subarray(i, i + chunk)))
    parts.push(encoder.encodeBuffer(left, right))
    onProgress?.(Math.min(1, (i + chunk) / frames))
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
  parts.push(encoder.flush())
  const out = new Uint8Array(parts.reduce((sum, p) => sum + p.length, 0))
  let offset = 0
  for (const p of parts) {
    out.set(p, offset)
    offset += p.length
  }
  return out
}
