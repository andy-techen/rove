import { describe, expect, it } from 'vitest'
import { analysePitch, hzToMidi, midiToHz } from './pitch'
import { scaleOf } from './key'
import { correctionRatios, shiftPitch } from './tuning'

const SR = 48000
const HOP = 0.01
const ANY_NOTE = scaleOf(null)
const snappy = { strength: 1, retuneSec: 0, scale: ANY_NOTE }

/** A pitch track holding `hz` for `frames` hops. */
const held = (hz: number, frames = 50): { hopSec: number; f0: Float32Array } => ({
  hopSec: HOP,
  f0: new Float32Array(frames).fill(hz)
})
const centsOf = (ratio: number): number => 1200 * Math.log2(ratio)

const voice = (hz: number, seconds: number): Float32Array =>
  Float32Array.from({ length: Math.round(seconds * SR) }, (_, i) => {
    const t = (2 * Math.PI * hz * i) / SR
    return 0.25 * Math.sin(t) + 0.12 * Math.sin(2 * t) + 0.06 * Math.sin(3 * t)
  })

describe('tuning corrections', () => {
  it('leaves the voice alone at zero strength', () => {
    const ratios = correctionRatios(held(midiToHz(60.3)), { ...snappy, strength: 0 })
    expect(Array.from(ratios).every((r) => r === 1)).toBe(true)
  })

  it('pulls a sharp note fully onto the note when snappy', () => {
    const ratios = correctionRatios(held(midiToHz(60.3)), snappy)
    expect(centsOf(ratios[10])).toBeCloseTo(-30, 1)
  })

  it('pulls only part of the way at partial strength', () => {
    const ratios = correctionRatios(held(midiToHz(60.3)), { ...snappy, strength: 0.5 })
    expect(centsOf(ratios[10])).toBeCloseTo(-15, 1)
  })

  it('eases in slowly when natural, so slides and vibrato survive', () => {
    const ratios = correctionRatios(held(midiToHz(60.3)), { ...snappy, retuneSec: 0.1 })
    expect(Math.abs(centsOf(ratios[2]))).toBeLessThan(10)
    expect(centsOf(ratios[49])).toBeCloseTo(-30, 0)
  })

  it('snaps to the key, not just the nearest semitone', () => {
    const cMajor = scaleOf({ tonic: 0, mode: 'major' })
    // A C♯ (61), out of C major: pulled up to D rather than left alone.
    const ratios = correctionRatios(held(midiToHz(61.2)), { ...snappy, scale: cMajor })
    expect(centsOf(ratios[10])).toBeCloseTo(80, 0)
  })

  it('never moves a note by more than a semitone', () => {
    const wholeTone = { ...snappy, scale: [0] }
    // Midway between two Cs is six semitones from either; the shift stops at one.
    const ratios = correctionRatios(held(midiToHz(66)), wholeTone)
    expect(Math.abs(centsOf(ratios[10]))).toBeCloseTo(100, 2)
  })

  it('does not touch unpitched sounds', () => {
    const track = held(0)
    expect(Array.from(correctionRatios(track, snappy)).every((r) => r === 1)).toBe(true)
  })
})

describe('pitch shifting', () => {
  it('returns the take unchanged when nothing needs correcting', () => {
    const take = voice(220, 0.3)
    const out = shiftPitch(
      take,
      SR,
      HOP,
      new Float32Array(31).fill(1),
      new Float32Array(31).fill(220)
    )
    let worst = 0
    for (let i = 0; i < take.length; i++) worst = Math.max(worst, Math.abs(out[i] - take[i]))
    expect(worst).toBeLessThan(1e-6)
  })

  it('brings a flat note up to pitch and keeps its timing', async () => {
    const flat = midiToHz(57 - 0.4)
    const take = voice(flat, 1)
    const track = await analysePitch(take, SR)
    const tuned = shiftPitch(take, SR, track.hopSec, correctionRatios(track, snappy), track.f0)
    expect(tuned.length).toBe(take.length)
    const after = await analysePitch(tuned, SR)
    const mid = Array.from(after.f0.subarray(30, 70))
    for (const hz of mid) expect(Math.abs(hzToMidi(hz) - 57)).toBeLessThan(0.05)
  })
})
