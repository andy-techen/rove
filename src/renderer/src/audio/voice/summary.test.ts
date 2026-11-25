import { LANDING_BIN_CENTS, LANDING_RANGE_CENTS } from '@shared/voice'
import { describe, expect, it } from 'vitest'
import { midiToHz } from '../pitch/pitch'
import { summariseTake } from './summary'

const SR = 48000
const A3 = 57
const E4 = 64

/** A sung-like tone: a fundamental with a few weaker harmonics. */
const voice = (hz: number, seconds: number): Float32Array =>
  Float32Array.from({ length: Math.round(seconds * SR) }, (_, i) => {
    const t = (2 * Math.PI * hz * i) / SR
    return 0.25 * Math.sin(t) + 0.12 * Math.sin(2 * t) + 0.06 * Math.sin(3 * t)
  })
const silence = (seconds: number): Float32Array => new Float32Array(Math.round(seconds * SR))
const join = (...parts: Float32Array[]): Float32Array => {
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0))
  parts.reduce((at, p) => (out.set(p, at), at + p.length), 0)
  return out
}
const whole = { offsetSec: 0, durationSec: 0 }
const notes = (noteSec: Record<number, number>): number[] => Object.keys(noteSec).map(Number)

describe('summariseTake', () => {
  it('counts the time a note is sung, and the whole window recorded', async () => {
    const summary = await summariseTake(join(silence(0.5), voice(220, 1)), SR, whole)
    expect(summary.recordedSec).toBeCloseTo(1.5, 3)
    expect(summary.sungSec).toBeCloseTo(1, 1)
    expect(summary.noteSec[A3]).toBeCloseTo(1, 1)
  })

  it('takes range only from notes held long enough', async () => {
    const blip = join(silence(0.3), voice(midiToHz(E4), 0.08), silence(0.3))
    const short = await summariseTake(blip, SR, whole)
    expect(short.sungSec).toBeGreaterThan(0)
    expect(short.lowestNote).toBeNull()
    const held = await summariseTake(join(blip, voice(220, 0.4), silence(0.3)), SR, whole)
    expect([held.lowestNote, held.highestNote]).toEqual([A3, A3])
  })

  it('leaves a passing note out of the time on each note', async () => {
    const take = join(voice(midiToHz(E4), 0.08), silence(0.3), voice(220, 0.5))
    const summary = await summariseTake(take, SR, whole)
    expect(notes(summary.noteSec)).toEqual([A3])
  })

  it('splits a run where the pitch jumps to a new note', async () => {
    const summary = await summariseTake(join(voice(220, 0.5), voice(midiToHz(E4), 0.5)), SR, whole)
    expect([summary.lowestNote, summary.highestNote]).toEqual([A3, E4])
  })

  it('listens only to the played window', async () => {
    const take = join(voice(220, 1), voice(midiToHz(E4), 1))
    expect(
      notes((await summariseTake(take, SR, { offsetSec: 1, durationSec: 0 })).noteSec)
    ).toEqual([E4])
    expect(
      notes((await summariseTake(take, SR, { offsetSec: 0, durationSec: 1 })).noteSec)
    ).toEqual([A3])
  })

  it('bins a note sung 15 cents sharp by where it lands', async () => {
    const { landing } = await summariseTake(voice(midiToHz(A3 + 0.15), 0.5), SR, whole)
    const bin = landing.findIndex((n) => n > 0)
    expect(landing.reduce((a, b) => a + b)).toBe(1)
    const centre = -LANDING_RANGE_CENTS + (bin + 0.5) * LANDING_BIN_CENTS
    expect(Math.abs(centre - 15)).toBeLessThanOrEqual(LANDING_BIN_CENTS)
  })

  it('sums tone over the sung moments only', async () => {
    const sung = await summariseTake(join(silence(1), voice(220, 1)), SR, whole)
    expect(sung.tone.frames).toBeGreaterThan(30)
    expect(sung.tone.mid).toBeGreaterThan(0)
    expect((await summariseTake(silence(1), SR, whole)).tone.frames).toBe(0)
  })
})
