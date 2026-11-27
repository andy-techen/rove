import { describe, expect, it } from 'vitest'
import { dbToGain } from '../dsp/units'
import { VOICE_OVER_MUSIC_DB, balancedMusicVolume } from './balance'

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
