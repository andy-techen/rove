import { LANDING_BIN_CENTS, LANDING_RANGE_CENTS } from '@shared/songs/constants'
import { describe, expect, it } from 'vitest'
import { midiToHz } from '../pitch/pitch'
import { summariseTake } from './summary'
import { join, silence, voice } from '../../test/signals'

const SR = 48000
const A3 = 57
const E4 = 64

/** A smooth slide from one pitch to another, as when a singer glides between notes. */
const glide = (fromHz: number, toHz: number, seconds: number): Float32Array => {
  let phase = 0
  return Float32Array.from({ length: Math.round(seconds * SR) }, (_, i) => {
    const at = i / (seconds * SR)
    phase += (2 * Math.PI * fromHz * Math.pow(toHz / fromHz, at)) / SR
    return 0.25 * Math.sin(phase) + 0.12 * Math.sin(2 * phase) + 0.06 * Math.sin(3 * phase)
  })
}
const whole = { offsetSec: 0, durationSec: 0 }
const held = (landing: number[]): number => landing.reduce((a, b) => a + b, 0)
/** The cents each landed note sits at, by the middle of its bin. */
const landedCents = (landing: number[]): number[] =>
  landing.flatMap((n, i) =>
    Array<number>(n).fill(-LANDING_RANGE_CENTS + (i + 0.5) * LANDING_BIN_CENTS)
  )
const C4 = 60
const notes = (noteSec: Record<number, number>): number[] => Object.keys(noteSec).map(Number)

describe('summariseTake', () => {
  it('counts the time a note is sung, and the whole window recorded', async () => {
    const summary = await summariseTake(join(silence(0.5), voice(220, 1)), SR, whole)
    expect(summary.recordedSec).toBeCloseTo(1.5, 3)
    expect(summary.sungSec).toBeCloseTo(1, 1)
    expect(summary.noteSec[A3]).toBeCloseTo(1, 1)
  })

  it('leaves a passing note out of the range and the time on each note', async () => {
    const blip = join(silence(0.3), voice(midiToHz(E4), 0.08), silence(0.3))
    const short = await summariseTake(blip, SR, whole)
    expect(short.sungSec).toBeGreaterThan(0)
    expect(short.lowestNote).toBeNull()
    const take = await summariseTake(join(blip, voice(220, 0.4), silence(0.3)), SR, whole)
    expect([take.lowestNote, take.highestNote]).toEqual([A3, A3])
    expect(notes(take.noteSec)).toEqual([A3])
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

  it('bins a note by how far it lands from the rest of the take', async () => {
    const gap = silence(0.2)
    const take = join(
      ...[A3, C4, E4].flatMap((n) => [voice(midiToHz(n), 0.5), gap]),
      voice(midiToHz(A3 + 0.2), 0.5)
    )
    const cents = landedCents((await summariseTake(take, SR, whole)).landing)
    expect(cents).toHaveLength(4)
    const spread = Math.max(...cents) - Math.min(...cents)
    expect(Math.abs(spread - 20)).toBeLessThanOrEqual(LANDING_BIN_CENTS)
  })

  it("measures held notes against the take's own tuning, not A440", async () => {
    const detuned = (n: number) => voice(midiToHz(n + 0.35), 0.5)
    const take = join(detuned(A3), silence(0.2), detuned(C4), silence(0.2), detuned(E4))
    const cents = landedCents((await summariseTake(take, SR, whole)).landing)
    expect(cents).toHaveLength(3)
    for (const c of cents) expect(Math.abs(c)).toBeLessThanOrEqual(LANDING_BIN_CENTS)
  })

  it('does not count a slide as a held note', async () => {
    const { landing } = await summariseTake(glide(midiToHz(A3), midiToHz(E4), 1), SR, whole)
    expect(held(landing)).toBe(0)
  })

  it('splits notes joined by a slide and measures each on its own', async () => {
    const take = join(
      voice(midiToHz(A3), 0.5),
      glide(midiToHz(A3), midiToHz(E4), 0.25),
      voice(midiToHz(E4), 0.5)
    )
    const cents = landedCents((await summariseTake(take, SR, whole)).landing)
    expect(cents).toHaveLength(2)
    for (const c of cents) expect(Math.abs(c)).toBeLessThanOrEqual(LANDING_BIN_CENTS)
  })

  it('sums tone over the sung moments only', async () => {
    const sung = await summariseTake(join(silence(1), voice(220, 1)), SR, whole)
    expect(sung.tone.frames).toBeGreaterThan(30)
    expect(sung.tone.mid).toBeGreaterThan(0)
    expect((await summariseTake(silence(1), SR, whole)).tone.frames).toBe(0)
  })
})
