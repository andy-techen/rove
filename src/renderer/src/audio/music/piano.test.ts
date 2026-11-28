import { describe, expect, it } from 'vitest'
import { PianoEvent } from '../../state/chords/pianoPart'
import { nearestSample, onsetOf, renderPiano } from './piano'
import { midiToHz } from '../pitch/pitch'
import { tone } from '../../test/signals'

const RATE = 8000

// A stand-in sample: a steady sine at the note's pitch, one second long.
const sine = (midi: number): Float32Array => tone(midiToHz(midi), 1, 1, RATE)
const samples = new Map([60, 63].map((m) => [m, sine(m)]))
const note = (midi: number, time = 0, holdSec = 0.5): PianoEvent => ({
  time,
  midi,
  velocity: 1,
  holdSec
})

/** Rising zero crossings per second: the pitch of a steady tone. */
const hzOf = (x: Float32Array, from: number, to: number): number => {
  let crossings = 0
  for (let n = from + 1; n < to; n++) if (x[n - 1] < 0 && x[n] >= 0) crossings++
  return crossings / ((to - from) / RATE)
}
const loudest = (x: Float32Array, from: number, to: number): number =>
  Math.max(...x.subarray(from, to).map(Math.abs))

describe('nearestSample', () => {
  it('plays each note from the closest sample', () => {
    expect(nearestSample(61, [60, 63])).toBe(60)
    expect(nearestSample(62, [60, 63])).toBe(63)
  })
})

describe('renderPiano', () => {
  it('shifts a sample to the note asked for', async () => {
    const out = await renderPiano([note(61)], samples, 0, 1, RATE)
    expect(hzOf(out, 0, RATE / 4)).toBeCloseTo(277, -1)
  })

  it('starts each note at its time', async () => {
    const out = await renderPiano([note(60, 0.5)], samples, 0, 1, RATE)
    expect(loudest(out, 0, RATE / 2 - 1)).toBe(0)
    expect(loudest(out, RATE / 2, RATE)).toBeGreaterThan(0)
  })

  it('dies away soon after the key is let go', async () => {
    const out = await renderPiano([note(60, 0, 0.2)], samples, 0, 1, RATE)
    expect(loudest(out, RATE * 0.1, RATE * 0.2)).toBeGreaterThan(0.05)
    expect(loudest(out, RATE * 0.6, RATE)).toBe(0)
  })

  it('stays under full scale with both hands striking at once', async () => {
    // The most a voicing strikes together: a bass note and a four-note chord.
    const chord = [43, 60, 64, 67, 71].map((m) => note(m))
    const out = await renderPiano(chord, samples, 0, 1, RATE)
    expect(loudest(out, 0, RATE)).toBeLessThan(1)
  })
})

describe('onsetOf', () => {
  it('finds where the note starts after an encoder’s leading silence', () => {
    const padded = new Float32Array(100 + RATE)
    padded.set(sine(60), 100)
    expect(onsetOf(padded, RATE)).toBeGreaterThan(90)
    expect(onsetOf(padded, RATE)).toBeLessThanOrEqual(100)
  })
})
