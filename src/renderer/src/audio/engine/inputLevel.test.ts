import { describe, expect, it } from 'vitest'
import { nextInputVolume } from './inputLevel'

describe('nextInputVolume', () => {
  it.each([
    ['turns a quiet singer up toward the target', 37, -22, 61],
    ['turns a loud singer down', 60, -4, 48],
    ['backs well off when the voice clipped', 80, 0, 56],
    ['leaves a level that is already about right', 50, -11, 50],
    ['stays under the top of the volume range', 95, -40, 100],
    ['stays over the bottom of the volume range', 8, 0, 5],
    ['does nothing when it heard no singing', 50, -60, null]
  ])('%s', (_, volume, peakDb, next) => {
    expect(nextInputVolume(volume, peakDb)).toBe(next)
  })
})
