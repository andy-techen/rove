import { describe, expect, it } from 'vitest'
import { arcPath, dragValue, pointAt } from './knobMath'

const volume = { min: 0, max: 100, step: 1 }
const key = { min: -6, max: 6, step: 1, centre: 0 }

describe('knob geometry', () => {
  it('points straight up at the middle of its travel', () => {
    const top = pointAt(0.5, 40)
    expect(top.x).toBeCloseTo(50)
    expect(top.y).toBeCloseTo(10)
  })

  it('starts bottom-left and ends bottom-right', () => {
    expect(pointAt(0, 40).x).toBeLessThan(50)
    expect(pointAt(1, 40).x).toBeGreaterThan(50)
    expect(pointAt(0, 40).y).toBeCloseTo(pointAt(1, 40).y)
  })

  it('draws nothing for an empty arc, and the long way round for most of the ring', () => {
    expect(arcPath(0.5, 0.5, 40)).toBe('')
    expect(arcPath(0, 1, 40)).toMatch(/ 0 1 1 /)
    expect(arcPath(0.5, 0.6, 40)).toMatch(/ 0 0 1 /)
  })
})

describe('dragValue', () => {
  it('turns up as the pointer moves up, across the whole range in one long drag', () => {
    expect(dragValue(50, 80, volume)).toBe(100)
    expect(dragValue(50, -40, volume)).toBe(25)
  })

  it('stays within the range and on whole steps', () => {
    expect(dragValue(90, 500, volume)).toBe(100)
    expect(dragValue(0, 5, key)).toBe(0)
    expect(dragValue(0, 30, key)).toBe(2)
  })

  it('clicks onto the centre when close to it', () => {
    const speed = { min: 70, max: 130, step: 1, centre: 100 }
    expect(dragValue(110, -22, speed)).toBe(100)
    expect(dragValue(110, -10, speed)).toBe(106)
  })
})
