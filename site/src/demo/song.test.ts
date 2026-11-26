import { describe, expect, it } from 'vitest'
import { BEATS, HARMONY, MELODY, thirdAbove } from './song'

describe('thirdAbove', () => {
  it('stacks a major or minor third, whichever C major has', () => {
    expect(thirdAbove(60)).toBe(64) // C → E
    expect(thirdAbove(62)).toBe(65) // D → F
  })

  it('crosses into the next octave', () => {
    expect(thirdAbove(69)).toBe(72) // A → C
    expect(thirdAbove(71)).toBe(74) // B → D
  })

  it('refuses notes outside the key', () => {
    expect(() => thirdAbove(61)).toThrow()
  })
})

describe('the demo song', () => {
  it('ends every note inside the loop, so it repeats without a cut-off', () => {
    for (const note of [...MELODY, ...HARMONY]) expect(note.beat + note.beats).toBeLessThan(BEATS)
  })
})
