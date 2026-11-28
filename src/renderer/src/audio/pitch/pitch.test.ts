import { describe, expect, it } from 'vitest'
import { analysePitch, hzToMidi } from './pitch'
import { median } from '../dsp/stats'
import { tone, voice } from '../../test/signals'

const SR = 48000

/**
 * A rough voice: the vocal folds fall into a two-cycle pattern, so every other cycle
 * differs (energy at 1.5× the note) while nothing sounds an octave below.
 */
const roughVoice = (hz: number, seconds: number): Float32Array =>
  Float32Array.from({ length: Math.round(seconds * SR) }, (_, i) => {
    const t = (2 * Math.PI * hz * i) / SR
    return 0.25 * Math.sin(t) + 0.12 * Math.sin(2 * t) + 0.12 * Math.sin(1.5 * t)
  })

const voiced = (f0: Float32Array): number[] => Array.from(f0).filter((f) => f > 0)

describe('pitch detection', () => {
  it.each([80, 110, 220, 440, 880])('finds a %i Hz note', async (hz) => {
    const { f0 } = await analysePitch(voice(hz, 0.5), SR)
    const found = voiced(f0)
    expect(found.length).toBeGreaterThan(f0.length * 0.8)
    // Within 5 cents.
    expect(Math.abs(hzToMidi(median(found)) - hzToMidi(hz))).toBeLessThan(0.05)
  })

  it('hears a rough voice at the note sung, not an octave below', async () => {
    const { f0 } = await analysePitch(roughVoice(220, 0.5), SR)
    expect(median(voiced(f0))).toBeCloseTo(220, 0)
  })

  it('hears nothing in silence', async () => {
    const { f0 } = await analysePitch(new Float32Array(SR / 2), SR)
    expect(voiced(f0)).toEqual([])
  })

  it('reports one value per hop, spanning the whole take', async () => {
    const { f0, hopSec } = await analysePitch(tone(220, 1), SR)
    expect(f0.length).toBe(Math.floor(1 / hopSec) + 1)
  })

  it('follows a melody from note to note', async () => {
    const melody = new Float32Array(SR)
    melody.set(voice(220, 0.5))
    melody.set(voice(330, 0.5), SR / 2)
    const { f0, hopSec } = await analysePitch(melody, SR)
    const at = (sec: number): number => f0[Math.round(sec / hopSec)]
    expect(at(0.25)).toBeCloseTo(220, 0)
    expect(at(0.75)).toBeCloseTo(330, 0)
  })
})
