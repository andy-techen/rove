import { describe, expect, it } from 'vitest'
import { nextInputVolume } from './inputLevel'

describe('nextInputVolume', () => {
  it('turns a quiet singer up toward the target', () => {
    expect(nextInputVolume(37, -22)).toBe(61)
  })

  it('turns a loud singer down', () => {
    expect(nextInputVolume(60, -4)).toBe(48)
  })

  it('backs well off when the voice clipped', () => {
    expect(nextInputVolume(80, 0)).toBe(56)
  })

  it('leaves a level that is already about right', () => {
    expect(nextInputVolume(50, -11)).toBe(50)
  })

  it('stays inside the volume range', () => {
    expect(nextInputVolume(95, -40)).toBe(100)
    expect(nextInputVolume(8, 0)).toBe(5)
  })

  it('does nothing when it heard no singing', () => {
    expect(nextInputVolume(50, -60)).toBeNull()
  })
})
