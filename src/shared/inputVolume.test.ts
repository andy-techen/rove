import { describe, expect, it } from 'vitest'
import { parseInputVolume } from './inputVolume'

describe('parseInputVolume', () => {
  it('reads the volume AppleScript prints', () => {
    expect(parseInputVolume('37\n')).toBe(37)
  })

  it('is null for an input without a volume', () => {
    expect(parseInputVolume('missing value\n')).toBeNull()
    expect(parseInputVolume('')).toBeNull()
  })

  it('keeps a requested volume whole and in range', () => {
    expect(parseInputVolume(140)).toBe(100)
    expect(parseInputVolume(-3)).toBe(0)
    expect(parseInputVolume(41.6)).toBe(42)
  })
})
