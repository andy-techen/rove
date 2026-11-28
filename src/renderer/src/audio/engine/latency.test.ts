import { describe, expect, it } from 'vitest'
import { alignTake, estimatedLatency, learnLatency } from './latency'

describe('alignTake', () => {
  it.each([
    ['shifts a take earlier by the latency', 10, 0.02, [9.98, 0, 5]],
    ['trims the late start instead of going before the song begins', 0, 0.02, [0, 0.02, 4.98]],
    ['leaves the take alone with no latency', 3, 0, [3, 0, 5]]
  ])('%s', (_, start, latency, [alignedStart, offset, duration]) => {
    const aligned = alignTake(start, 5, latency)
    expect(aligned.start).toBeCloseTo(alignedStart)
    expect(aligned.offset).toBeCloseTo(offset)
    expect(aligned.duration).toBeCloseTo(duration)
  })
})

describe('estimatedLatency', () => {
  it('counts the mic’s delay as well as the output’s', () => {
    const ctx = { outputLatency: 0.01, baseLatency: 0.005 } as AudioContext
    expect(estimatedLatency(ctx, 0.008)).toBeCloseTo(0.023)
  })
})

describe('learnLatency', () => {
  it('adds a lined-up take’s lag to what was learned', () => {
    expect(learnLatency(0.1, 0.03)).toBeCloseTo(0.13)
  })

  it('never learns an implausible delay', () => {
    expect(learnLatency(0.4, 0.3)).toBe(0.5)
    expect(learnLatency(0, -0.3)).toBe(-0.1)
  })
})
