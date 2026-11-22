import { describe, expect, it } from 'vitest'
import { midiToHz } from './pitch'
import { detectChords } from './chords'

const SR = 48000
const C = 0
const F = 5
const G = 7
const A = 9

/** A chord as a pad of soft tones with a few harmonics, plus its root an octave down. */
function chord(notes: number[], seconds: number): Float32Array {
  const out = new Float32Array(Math.round(seconds * SR))
  for (const note of [notes[0] - 12, ...notes]) {
    const hz = midiToHz(note)
    for (let i = 0; i < out.length; i++) {
      const t = (2 * Math.PI * hz * i) / SR
      out[i] += 0.08 * Math.sin(t) + 0.03 * Math.sin(2 * t) + 0.015 * Math.sin(3 * t)
    }
  }
  return out
}

function progression(chords: number[][], seconds: number): Float32Array {
  const parts = chords.map((c) => chord(c, seconds))
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}

describe('detectChords', () => {
  it('names a I–V–vi–IV progression in C', async () => {
    // C, G, Am, F: two seconds each.
    const audio = progression(
      [
        [60, 64, 67],
        [55, 59, 62],
        [57, 60, 64],
        [53, 57, 60]
      ],
      2
    )
    const found = await detectChords({ channels: [audio], sampleRate: SR })
    expect(found.map((c) => (c.chord ? `${c.chord.root}${c.chord.quality}` : '-'))).toEqual([
      `${C}major`,
      `${G}major`,
      `${A}minor`,
      `${F}major`
    ])
  })

  it('puts each change close to where it happens', async () => {
    const audio = progression(
      [
        [60, 64, 67],
        [57, 60, 64]
      ],
      3
    )
    const [first, second] = await detectChords({ channels: [audio], sampleRate: SR })
    expect(first.start).toBeCloseTo(0, 0)
    expect(Math.abs(second.start - 3)).toBeLessThan(0.4)
    expect(Math.abs(second.end - 6)).toBeLessThan(0.4)
  })

  it('hears no chords in silence', async () => {
    const found = await detectChords({ channels: [new Float32Array(SR * 3)], sampleRate: SR })
    expect(found.every((c) => c.chord === null)).toBe(true)
  })
})
