import { describe, expect, it } from 'vitest'
import { seededNoise } from './noise'

const take = (next: () => number, n: number) => Array.from({ length: n }, () => next())

describe('seededNoise', () => {
  it('repeats exactly for the same seed', () => {
    expect(take(seededNoise(42), 50)).toEqual(take(seededNoise(42), 50))
  })

  it('stays between -1 and 1 and averages near zero', () => {
    const samples = take(seededNoise(1), 10000)
    expect(samples.every((s) => s >= -1 && s <= 1)).toBe(true)
    expect(Math.abs(samples.reduce((s, x) => s + x, 0) / samples.length)).toBeLessThan(0.05)
  })
})
