import { describe, expect, it } from 'vitest'
import { integratedLoudness, levelGainDb, samplePeakDb, withPeakCeiling } from './loudness'
import { tone } from '../../test/signals'

const RATE = 48000
const sine = (amplitude: number, seconds: number) => tone(997, seconds, amplitude, RATE)

describe('integratedLoudness (ITU-R BS.1770)', () => {
  it('reads a -20 dBFS tone in both channels as -20 LUFS', () => {
    const tone = sine(0.1, 3)
    expect(integratedLoudness([tone, tone], RATE)).toBeCloseTo(-20, 1)
  })

  it('ignores silence, so quiet gaps in a song do not drag the reading down', () => {
    const tone = sine(0.1, 3)
    const withGap = new Float32Array(tone.length * 2)
    withGap.set(tone)
    // Ungated it would read -23; only the blocks straddling the gap pull it down a touch.
    expect(integratedLoudness([withGap, withGap], RATE)).toBeCloseTo(-20, 0)
  })

  it('reports silence as -Infinity', () => {
    const silent = new Float32Array(RATE)
    expect(integratedLoudness([silent, silent], RATE)).toBe(-Infinity)
  })
})

describe('levelling', () => {
  it('finds the gain that lands on the target, within limits', () => {
    expect(levelGainDb(-20, -14)).toBeCloseTo(6)
    // A nearly silent mix isn't boosted into hiss.
    expect(levelGainDb(-60, -14)).toBe(20)
    expect(levelGainDb(-Infinity, -14)).toBe(0)
  })

  it('turns a mix down only when a sample passes the ceiling', () => {
    const loud = [sine(1, 1)]
    expect(samplePeakDb(withPeakCeiling(loud, -1))).toBeCloseTo(-1, 2)
    const quiet = [sine(0.1, 1)]
    expect(withPeakCeiling(quiet, -1)).toBe(quiet)
  })

  it('measures the highest sample in dBFS', () => {
    expect(samplePeakDb([sine(0.5, 1)])).toBeCloseTo(-6.02, 1)
  })
})
