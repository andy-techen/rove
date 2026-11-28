import { describe, expect, it } from 'vitest'
import { MusicClip, musicUnder, takeLag } from './lineUp'
import { seededNoise } from '../dsp/noise'

const RATE = 12000
const SONG_SEC = 10

/** Short bursts of noise at each time: drum hits, or sung syllables. */
function hits(times: number[], seed = 1): Float32Array {
  const out = new Float32Array(SONG_SEC * RATE)
  const noise = seededNoise(seed)
  for (const t of times) {
    const at = Math.round(t * RATE)
    for (let i = 0; i < 0.04 * RATE && at + i < out.length; i++) {
      out[at + i] += noise() * Math.exp(-i / (0.01 * RATE))
    }
  }
  return out
}

// A beat that isn't perfectly even, like a band's, so no lag matches by accident.
const beats = Array.from({ length: 18 }, (_, i) => 0.5 + i * 0.5 + ((i * 7) % 5) * 0.013)
const source = (channel: Float32Array) => ({ channels: [channel], sampleRate: RATE })

describe('takeLag', () => {
  it('hears how late the singing sits behind the music', async () => {
    const lag = await takeLag(
      source(
        hits(
          beats.map((t) => t + 0.14),
          2
        )
      ),
      source(hits(beats))
    )
    expect(lag).toBeCloseTo(0.14, 1)
  })

  it('finds a take in time to be in time', async () => {
    const lag = await takeLag(source(hits(beats, 2)), source(hits(beats)))
    expect(Math.abs(lag ?? 1)).toBeLessThan(0.02)
  })

  it('makes no guess when the singing has nothing to do with the music', async () => {
    expect(await takeLag(source(new Float32Array(SONG_SEC * RATE)), source(hits(beats)))).toBeNull()
  })
})

describe('musicUnder', () => {
  const clipOf = (samples: number[], start: number, offset = 0): MusicClip => ({
    buffer: {
      numberOfChannels: 1,
      sampleRate: 1,
      getChannelData: () => Float32Array.from(samples)
    },
    start,
    offset,
    duration: samples.length - offset
  })

  it('mixes the music playing over the window, where each clip sits', () => {
    const music = musicUnder([clipOf([1, 2, 3], 1), clipOf([10, 20], 2, 1)], 1, 3, 1)
    expect(Array.from(music)).toEqual([1, 22, 3])
  })
})
