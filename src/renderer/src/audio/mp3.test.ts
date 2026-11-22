import { describe, expect, it, vi } from 'vitest'
import { encodeMp3 } from './mp3'

const RATE = 48000
const tone = Float32Array.from(
  { length: RATE },
  (_, i) => 0.3 * Math.sin((2 * Math.PI * 440 * i) / RATE)
)

describe('encodeMp3', () => {
  it('encodes a second of stereo at about 320 kbps, reporting progress', async () => {
    const progress = vi.fn()
    const mp3 = await encodeMp3([tone, tone], RATE, progress)
    // MPEG audio frames start with an 11-bit sync word.
    expect(mp3[0]).toBe(0xff)
    expect(mp3[1] & 0xe0).toBe(0xe0)
    expect(mp3.length).toBeGreaterThan(30_000)
    expect(mp3.length).toBeLessThan(50_000)
    expect(progress).toHaveBeenLastCalledWith(1)
  })
})
