import { describe, expect, it } from 'vitest'
import { PeakAccumulator } from './peaks'

describe('PeakAccumulator', () => {
  const acc = (): PeakAccumulator => {
    const a = new PeakAccumulator(2)
    a.push(new Float32Array([0.1, -0.5, 0.3, 0.9, -0.2, 0, 0.4, -0.1]))
    return a
  }

  it('keeps the min and max of each full bucket', () => {
    expect(acc().bucketCount).toBe(4)
    expect(Array.from(acc().resample(4, 1)).map((v) => +v.toFixed(2))).toEqual([
      -0.5, 0.1, 0, 0.9, -0.2, 0, -0.1, 0.4
    ])
  })

  it('buffers a partial bucket until it fills, across pushes', () => {
    const a = new PeakAccumulator(3)
    a.push(new Float32Array([0.2, -0.3]))
    expect(a.bucketCount).toBe(0)
    a.push(new Float32Array([0.5]))
    expect(a.bucketCount).toBe(1)
  })

  it('merges buckets when zoomed out', () => {
    expect(Array.from(acc().resample(2, 2)).map((v) => +v.toFixed(2))).toEqual([
      -0.5, 0.9, -0.2, 0.4
    ])
  })

  it('starts from a later bucket for trimmed clips', () => {
    expect(Array.from(acc().resample(1, 2, 2)).map((v) => +v.toFixed(2))).toEqual([-0.2, 0.4])
  })

  it('stops at the end of the audio', () => {
    const peaks = acc().resample(3, 2)
    expect(Array.from(peaks.slice(4))).toEqual([0, 0])
  })
})
