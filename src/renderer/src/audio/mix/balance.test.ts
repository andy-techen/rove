import { describe, expect, it } from 'vitest'
import { dbToGain } from '../dsp/units'
import {
  HARMONY_UNDER_LEAD_DB,
  VOICE_OVER_MUSIC_DB,
  balancedHarmonyVolume,
  balancedMusicVolume
} from './balance'

const RATE = 48000
const tone = (amplitude: number, sec = 5): Float32Array =>
  Float32Array.from(
    { length: sec * RATE },
    (_, i) => amplitude * Math.sin((2 * Math.PI * 1000 * i) / RATE)
  )

describe('balancedMusicVolume', () => {
  it('turns loud music down so the voice sits on top', () => {
    const volume = balancedMusicVolume(tone(0.02), tone(0.4), RATE)
    expect(volume).toBeCloseTo(dbToGain(-VOICE_OVER_MUSIC_DB) * (0.02 / 0.4), 2)
  })

  it('never turns the music up past as recorded', () => {
    expect(balancedMusicVolume(tone(0.5), tone(0.01), RATE)).toBe(1)
  })

  it('makes no change when the take is silent', () => {
    expect(balancedMusicVolume(new Float32Array(5 * RATE), tone(0.4), RATE)).toBeNull()
  })
})

describe('balancedHarmonyVolume', () => {
  const under = dbToGain(-HARMONY_UNDER_LEAD_DB)

  it('sets a harmony as loud as the lead just under it', () => {
    expect(balancedHarmonyVolume(tone(0.2), tone(0.2), 1, RATE)).toBeCloseTo(under, 2)
  })

  it('turns a quiet harmony up to sit just under the lead', () => {
    const volume = balancedHarmonyVolume(tone(0.15), tone(0.2), 0.7, RATE)
    expect(volume).toBeCloseTo((0.2 / 0.15) * under, 2)
  })

  it('never turns a harmony up past as recorded', () => {
    expect(balancedHarmonyVolume(tone(0.01), tone(0.4), 0.7, RATE)).toBe(1)
  })

  it('leaves a harmony that already sits about right', () => {
    expect(balancedHarmonyVolume(tone(0.2), tone(0.2), under * 1.05, RATE)).toBeNull()
  })

  it('makes no change when the lead is silent', () => {
    expect(balancedHarmonyVolume(tone(0.2), new Float32Array(5 * RATE), 0.7, RATE)).toBeNull()
  })
})
