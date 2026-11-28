import { describe, expect, it } from 'vitest'
import { dbToGain } from '../dsp/units'
import { tone as toneAt } from '../../test/signals'
import { balancedHarmonyVolume, balancedMusicVolume } from './balance'
import { HARMONY_UNDER_LEAD_DB, VOICE_OVER_MUSIC_DB } from './constants'

const RATE = 48000
// A second holds several of loudness's 400 ms gating blocks.
const tone = (amplitude: number): Float32Array => toneAt(1000, 1, amplitude, RATE)
const silent = new Float32Array(RATE)

describe('balancedMusicVolume', () => {
  it('turns loud music down so the voice sits on top', () => {
    const volume = balancedMusicVolume(tone(0.02), tone(0.4), RATE)
    expect(volume).toBeCloseTo(dbToGain(-VOICE_OVER_MUSIC_DB) * (0.02 / 0.4), 2)
  })

  it('never turns the music up past as recorded', () => {
    expect(balancedMusicVolume(tone(0.5), tone(0.01), RATE)).toBe(1)
  })

  it('makes no change when the take is silent', () => {
    expect(balancedMusicVolume(silent, tone(0.4), RATE)).toBeNull()
  })
})

describe('balancedHarmonyVolume', () => {
  const under = dbToGain(-HARMONY_UNDER_LEAD_DB)
  const sung = tone(0.2)

  it('sets a harmony as loud as the lead just under it', () => {
    expect(balancedHarmonyVolume(sung, sung, 1, RATE)).toBeCloseTo(under, 2)
  })

  it('turns a quiet harmony up to sit just under the lead', () => {
    const volume = balancedHarmonyVolume(tone(0.15), sung, 0.7, RATE)
    expect(volume).toBeCloseTo((0.2 / 0.15) * under, 2)
  })

  it('never turns a harmony up past as recorded', () => {
    expect(balancedHarmonyVolume(tone(0.01), tone(0.4), 0.7, RATE)).toBe(1)
  })

  it('leaves a harmony that already sits about right', () => {
    expect(balancedHarmonyVolume(sung, sung, under * 1.05, RATE)).toBeNull()
  })

  it('makes no change when the lead is silent', () => {
    expect(balancedHarmonyVolume(sung, silent, 0.7, RATE)).toBeNull()
  })
})
