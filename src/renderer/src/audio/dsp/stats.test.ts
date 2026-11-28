import { describe, expect, it } from 'vitest'
import { mean, median, percentile } from './stats'

describe('stats', () => {
  it('averages plain and typed arrays', () => {
    expect(mean([1, 2, 6])).toBe(3)
    expect(mean(Float32Array.of(1, 2, 6))).toBe(3)
  })

  it('takes the upper middle value as the median of an even count', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 3, 2])).toBe(3)
  })

  it('picks a real value at a percentile, rounding down', () => {
    const values = [50, 10, 40, 20, 30]
    expect(percentile(values, 0)).toBe(10)
    expect(percentile(values, 0.5)).toBe(30)
    expect(percentile(values, 0.9)).toBe(40)
    expect(percentile(values, 1)).toBe(50)
  })

  it('leaves the values it was given in their order', () => {
    const values = [3, 1, 2]
    median(values)
    percentile(values, 0.5)
    expect(values).toEqual([3, 1, 2])
  })
})
