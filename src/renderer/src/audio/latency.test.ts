import { describe, expect, it } from 'vitest'
import { CLICK_TIMES, alignTake, estimateLatency } from './latency'

const SR = 48000

function recording(
  delaySec: number | number[],
  opts: { noise?: number; level?: number } = {}
): Float32Array {
  const { noise = 0.002, level = 0.4 } = opts
  const samples = new Float32Array(Math.ceil(3.2 * SR))
  let seed = 1
  for (let i = 0; i < samples.length; i++) {
    seed = (seed * 16807) % 2147483647
    samples[i] = ((seed / 2147483647) * 2 - 1) * noise
  }
  CLICK_TIMES.forEach((t, n) => {
    const delay = Array.isArray(delaySec) ? delaySec[n] : delaySec
    const start = Math.round((t + delay) * SR)
    for (let i = 0; i < 200; i++) samples[start + i] += level * Math.sin(i / 3) * (1 - i / 200)
  })
  return samples
}

describe('estimateLatency', () => {
  it('measures a consistent delay', () => {
    expect(estimateLatency(recording(0.023), SR)).toBeCloseTo(0.023, 3)
  })

  it('tolerates one missed click', () => {
    const samples = recording(0.03)
    samples.fill(0, Math.round(1.0 * SR), Math.round(1.4 * SR))
    expect(estimateLatency(samples, SR)).toBeCloseTo(0.03, 3)
  })

  it('gives up when the clicks are lost in the noise', () => {
    expect(estimateLatency(recording(0.02, { noise: 0.2, level: 0.1 }), SR)).toBeNull()
  })

  it('gives up when the clicks disagree', () => {
    expect(estimateLatency(recording([0.02, 0.05, 0.02, 0.09, 0.02]), SR)).toBeNull()
  })

  it('gives up on silence', () => {
    expect(estimateLatency(new Float32Array(3.2 * SR), SR)).toBeNull()
  })
})

describe('alignTake', () => {
  it('shifts a take earlier by the latency', () => {
    expect(alignTake(10, 5, 0.02)).toEqual({ start: 9.98, offset: 0, duration: 5 })
  })

  it('trims the late start instead of going before the song begins', () => {
    const aligned = alignTake(0, 5, 0.02)
    expect(aligned.start).toBe(0)
    expect(aligned.offset).toBeCloseTo(0.02)
    expect(aligned.duration).toBeCloseTo(4.98)
  })

  it('leaves the take alone with no latency', () => {
    expect(alignTake(3, 5, 0)).toEqual({ start: 3, offset: 0, duration: 5 })
  })
})
