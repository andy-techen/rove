import { describe, expect, it } from 'vitest'
import { DrumHit, DrumVoice } from '../../state/chords/beats'
import { renderDrums } from './drums'

const RATE = 48000
const peak = (samples: Float32Array) => samples.reduce((m, v) => Math.max(m, Math.abs(v)), 0)
const VOICES: DrumVoice[] = ['kick', 'snare', 'clap', 'rim', 'hat', 'openHat', 'tom', 'crash']

describe('renderDrums', () => {
  it('places a hit where it falls, measured from the render’s start', () => {
    const out = renderDrums([{ time: 1.5, voice: 'kick', velocity: 1 }], 1, 1, RATE)
    const firstSound = out.findIndex((v) => Math.abs(v) > 1e-4) / RATE
    expect(firstSound).toBeCloseTo(0.5, 2)
  })

  it('stays under full scale with every drum struck hard and often', () => {
    const hits: DrumHit[] = Array.from({ length: 32 }, (_, k) =>
      VOICES.map((voice) => ({ time: k * 0.125, voice, velocity: 1 }))
    ).flat()
    const out = renderDrums(hits, 0, 5, RATE)
    expect(out.every((v) => Number.isFinite(v))).toBe(true)
    expect(peak(out)).toBeLessThan(1)
  })
})
