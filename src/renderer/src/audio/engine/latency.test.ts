import { describe, expect, it } from 'vitest'
import { alignTake } from './latency'

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
