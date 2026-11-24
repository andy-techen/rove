import { describe, expect, it } from 'vitest'
import { midiToHz } from '../pitch/pitch'
import { pluck, renderStrums } from './guitar'

const RATE = 48000

/** The pitch of a steady tone, from where its autocorrelation peaks near `expectedHz`. */
function pitchOf(samples: Float32Array, expectedHz: number): number {
  const window = samples.subarray(RATE / 10, RATE / 10 + 4096)
  const corr = (lag: number): number => {
    let sum = 0
    for (let i = 0; i + lag < window.length; i++) sum += window[i] * window[i + lag]
    return sum
  }
  const guess = RATE / expectedHz
  let best = Math.round(guess * 0.9)
  for (let lag = best; lag <= Math.round(guess * 1.1); lag++) if (corr(lag) > corr(best)) best = lag
  // Between samples: fit a parabola through the peak and its neighbours.
  const [a, b, c] = [corr(best - 1), corr(best), corr(best + 1)]
  return RATE / (best + (0.5 * (a - c)) / (a - 2 * b + c))
}

const cents = (hz: number, target: number): number => 1200 * Math.log2(hz / target)
const peak = (samples: Float32Array) => samples.reduce((m, v) => Math.max(m, Math.abs(v)), 0)

describe('pluck', () => {
  it('rings in tune across the guitar’s range', () => {
    for (const midi of [40, 52, 64, 76]) {
      const hz = midiToHz(midi)
      expect(Math.abs(cents(pitchOf(pluck(midi, RATE), hz), hz))).toBeLessThan(5)
    }
  })

  it('dies away, and never goes past full scale', () => {
    const note = pluck(52, RATE)
    const level = (from: number) => peak(note.subarray(from, from + 4800))
    expect(level(RATE * 2)).toBeLessThan(level(0) / 4)
    expect(peak(note)).toBeLessThanOrEqual(1)
  })
})

describe('renderStrums', () => {
  const chord = [40, 47, 52, 56, 59, 64].map((midi, string) => ({ string, midi }))

  it('aims a strum so it lands on its beat, measured from the render’s start', async () => {
    const out = await renderStrums(
      [{ time: 1.5, notes: chord, velocity: 1, direction: 'down' }],
      1,
      2,
      RATE
    )
    const firstSound = out.findIndex((v) => Math.abs(v) > 1e-4) / RATE
    // The pick sets off a moment early, so the strum's middle falls on the beat.
    expect(firstSound).toBeLessThan(0.5)
    expect(firstSound).toBeGreaterThan(0.45)
  })

  it('stays under full scale with every string struck hard and often', async () => {
    const events = Array.from({ length: 16 }, (_, k) => ({
      time: k * 0.25,
      notes: chord,
      velocity: 1,
      direction: 'down' as const
    }))
    const out = await renderStrums(events, 0, 5, RATE)
    expect(out.every((v) => Number.isFinite(v))).toBe(true)
    expect(peak(out)).toBeLessThan(1)
  })
})
