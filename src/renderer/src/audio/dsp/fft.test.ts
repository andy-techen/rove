import { describe, expect, it } from 'vitest'
import { hann } from './fft'

describe('hann', () => {
  it('ends on zero at both edges in its symmetric form', () => {
    const w = hann(9)
    expect(w[0]).toBe(0)
    expect(w[8]).toBeCloseTo(0, 12)
    expect(w[4]).toBe(1)
  })

  it('overlap-adds to exactly 1 at half-length hops in its periodic form', () => {
    const w = hann(8, true)
    expect(w[0]).toBe(0)
    expect(w[4]).toBe(1)
    for (let n = 0; n < 4; n++) expect(w[n] + w[n + 4]).toBeCloseTo(1, 12)
  })
})
