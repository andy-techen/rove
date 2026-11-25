import { describe, expect, it } from 'vitest'
import { AUTO_LIMITS, TONE_REFERENCE, suggestPolish } from './autoPolish'
import { POLISH_CONTROLS, defaultPolish, polishParams } from './polish'
import { PolishReading } from './polishReading'

/** A take that needs nothing special: a clean room, a steady voice, tone as expected. */
function profile(changes: Partial<PolishReading> = {}): PolishReading {
  return {
    voiceDb: -18,
    softDb: -26,
    rangeDb: 15,
    noiseDb: -61,
    hum: false,
    sibilanceDb: null,
    bodyDb: TONE_REFERENCE.bodyDb,
    presenceDb: TONE_REFERENCE.presenceDb,
    airDb: TONE_REFERENCE.airDb,
    clipped: false,
    ...changes
  }
}

const lead = (changes: Partial<PolishReading> = {}) => suggestPolish(profile(changes), 'lead')

describe('suggestPolish', () => {
  it('stays near our usual settings for a take that needs nothing special', () => {
    const { amounts, reasons } = lead()
    const usual = defaultPolish('lead')
    for (const key of ['cleanup', 'clarity', 'warmth', 'smoothness', 'space', 'deEss'] as const) {
      expect(Math.abs(amounts[key] - usual[key])).toBeLessThan(0.1)
    }
    expect(reasons).toEqual(['balanced'])
  })

  it('reduces more noise in a noisy room', () => {
    const { amounts, reasons } = lead({ noiseDb: -48 })
    expect(amounts.cleanup).toBeGreaterThan(defaultPolish('lead').cleanup)
    expect(reasons).toContain('noisyRoom')
  })

  it('never turns soft singing down to quiet the room', () => {
    const { amounts } = lead({ noiseDb: -40, softDb: -42 })
    const gate = polishParams({ ...defaultPolish('lead'), ...amounts }).gateThresholdDb
    expect(gate).toBeLessThanOrEqual(-42 - 10)
  })

  it('evens out a voice that moves a lot between soft and strong', () => {
    const { amounts, reasons } = lead({ rangeDb: 28 })
    expect(amounts.smoothness).toBeGreaterThan(lead().amounts.smoothness)
    expect(reasons).toContain('wideRange')
  })

  it('softens sharp "s" sounds', () => {
    const soft = lead({ sibilanceDb: -40 }).amounts.deEss
    const { amounts, reasons } = lead({ sibilanceDb: -16 })
    expect(amounts.deEss).toBeGreaterThan(soft)
    expect(reasons).toContain('sharpS')
  })

  it('adds warmth to a thin voice and takes it from a boomy one', () => {
    const usual = defaultPolish('lead').warmth
    expect(lead({ bodyDb: TONE_REFERENCE.bodyDb - 10 }).amounts.warmth).toBeGreaterThan(usual)
    expect(lead({ bodyDb: TONE_REFERENCE.bodyDb + 10 }).amounts.warmth).toBeLessThan(usual)
  })

  it('takes a little warmth away for hum, which raises the low cut', () => {
    const { amounts, reasons } = lead({ hum: true })
    expect(amounts.warmth).toBeLessThan(defaultPolish('lead').warmth)
    expect(reasons).toContain('hum')
  })

  it('brings a dull voice forward', () => {
    const dull = { presenceDb: TONE_REFERENCE.presenceDb - 10, airDb: TONE_REFERENCE.airDb - 10 }
    expect(lead(dull).amounts.clarity).toBeGreaterThan(defaultPolish('lead').clarity)
  })

  it('keeps a harmony further back than the lead from the same take', () => {
    const take = profile({ presenceDb: TONE_REFERENCE.presenceDb - 10 })
    const leadAmounts = suggestPolish(take, 'lead').amounts
    const harmony = suggestPolish(take, 'harmony').amounts
    expect(harmony.clarity).toBeLessThan(leadAmounts.clarity)
    expect(harmony.space).toBeGreaterThan(leadAmounts.space)
  })

  it('keeps every knob inside its auto-polish limits, whatever it hears', () => {
    const extremes = [
      profile({ noiseDb: -20, softDb: -10, voiceDb: -60, rangeDb: 60, sibilanceDb: 0 }),
      profile({ noiseDb: -120, voiceDb: 0, rangeDb: 0, bodyDb: 60, presenceDb: 60, airDb: 60 }),
      profile({ bodyDb: -60, presenceDb: -60, airDb: -60, hum: true })
    ]
    for (const take of extremes) {
      const { amounts } = suggestPolish(take, 'lead')
      for (const key of POLISH_CONTROLS.filter((k) => k !== 'tuning')) {
        const k = key as keyof typeof AUTO_LIMITS
        expect(amounts[k]).toBeGreaterThanOrEqual(AUTO_LIMITS[k].min)
        expect(amounts[k]).toBeLessThanOrEqual(AUTO_LIMITS[k].max)
      }
    }
  })

  it('leaves Tuning alone', () => {
    expect('tuning' in lead().amounts).toBe(false)
  })

  it('gives the same suggestion for the same take', () => {
    expect(lead({ noiseDb: -50, rangeDb: 22 })).toEqual(lead({ noiseDb: -50, rangeDb: 22 }))
  })
})
