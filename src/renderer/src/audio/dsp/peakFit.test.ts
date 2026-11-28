import { describe, expect, it } from 'vitest'
import { parabolicOffset } from './peakFit'

// Samples of a parabola whose vertex sits at x = 0.25.
const curve = (sign: number) => [-1, 0, 1].map((x) => sign * (x - 0.25) ** 2)

describe('parabolicOffset', () => {
  it('finds a peak between samples', () => {
    const [a, b, c] = curve(-1)
    expect(parabolicOffset(a, b, c, 'peak')).toBeCloseTo(0.25, 12)
  })

  it('finds a dip between samples', () => {
    const [a, b, c] = curve(1)
    expect(parabolicOffset(a, b, c, 'dip')).toBeCloseTo(0.25, 12)
  })

  it('stays put when the samples curve the other way or not at all', () => {
    const [a, b, c] = curve(1)
    expect(parabolicOffset(a, b, c, 'peak')).toBe(0)
    expect(parabolicOffset(1, 2, 3, 'dip')).toBe(0)
  })
})
