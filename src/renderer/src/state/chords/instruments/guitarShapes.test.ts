import { describe, expect, it } from 'vitest'
import { CHORD_QUALITIES, CHORD_TONES } from '../../../audio/music/chords'
import { fretsOf, gripOf } from './guitarShapes'

describe('gripOf', () => {
  it('shows open chords from the nut, with open and muted strings', () => {
    // C: x32010
    const c = gripOf({ root: 0, quality: 'major' })
    expect(c.baseFret).toBe(1)
    expect(c.muted).toEqual([0])
    expect(c.open).toEqual([3, 5])
    expect(c.dots).toEqual([
      { string: 1, fret: 3 },
      { string: 2, fret: 2 },
      { string: 4, fret: 1 }
    ])
    expect(c.barre).toBeNull()
  })

  it('draws a barre across the strings one finger holds', () => {
    // F: 133211, the first finger across all six strings at fret 1.
    const f = gripOf({ root: 5, quality: 'major' })
    expect(f.barre).toEqual({ fret: 1, from: 0, to: 5 })
    expect(f.dots).toEqual([
      { string: 1, fret: 3 },
      { string: 2, fret: 3 },
      { string: 3, fret: 2 }
    ])
  })

  it('starts the diagram up the neck for chords played there', () => {
    // C♯m: x46654, shown from fret 4.
    const grip = gripOf({ root: 1, quality: 'minor' })
    expect(grip.baseFret).toBe(4)
    expect(grip.barre).toEqual({ fret: 1, from: 1, to: 5 })
  })

  it('has a shape for every major and minor chord', () => {
    for (const quality of ['major', 'minor'] as const) {
      for (let root = 0; root < 12; root++) {
        const grip = gripOf({ root, quality })
        expect(grip.muted.length + grip.open.length + grip.dots.length).toBeGreaterThan(0)
      }
    }
  })
})

describe('fretsOf', () => {
  // Standard tuning, low to high: E2 A2 D3 G3 B3 E4.
  const OPEN_STRINGS = [40, 45, 50, 55, 59, 64]
  const STEPS = { major: [0, 4, 7], minor: [0, 3, 7] }

  it('plays exactly the notes of each chord, with its root in the bass', () => {
    for (const quality of ['major', 'minor'] as const) {
      for (let root = 0; root < 12; root++) {
        const notes = fretsOf({ root, quality }).flatMap((fret, s) =>
          fret < 0 ? [] : [OPEN_STRINGS[s] + fret]
        )
        const classes = new Set(notes.map((n) => n % 12))
        const expected = new Set(STEPS[quality].map((step) => (root + step) % 12))
        expect([...classes].sort()).toEqual([...expected].sort())
        expect(Math.min(...notes) % 12).toBe(root)
      }
    }
  })

  it('plays every other kind of chord on every root, root in the bass', () => {
    for (const quality of CHORD_QUALITIES) {
      for (let root = 0; root < 12; root++) {
        const notes = fretsOf({ root, quality }).flatMap((fret, s) =>
          fret < 0 ? [] : [OPEN_STRINGS[s] + fret]
        )
        const tones = CHORD_TONES[quality].map((step) => (root + step) % 12)
        const classes = new Set(notes.map((n) => n % 12))
        // Every note belongs to the chord; only a plain fifth may be left out, as
        // guitarists do in shapes like C7 (x32310).
        expect([...classes].every((c) => tones.includes(c))).toBe(true)
        const fifth = (root + 7) % 12
        expect(tones.filter((c) => c !== fifth).every((c) => classes.has(c))).toBe(true)
        expect(Math.min(...notes) % 12).toBe(root)
      }
    }
  })
})
