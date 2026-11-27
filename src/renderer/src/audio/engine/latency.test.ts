import { describe, expect, it } from 'vitest'
import { alignTake, estimatedLatency, learnLatency } from './latency'

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
