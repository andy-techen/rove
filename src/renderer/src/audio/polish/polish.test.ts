import { describe, expect, it } from 'vitest'
import { PARAM_RANGES, PolishParams, builtInMakeupDb, defaultPolish, polishParams } from './polish'

const zero = {
  enabled: true,
  cleanup: 0,
  clarity: 0,
  warmth: 0,
  smoothness: 0,
  space: 0,
  deEss: 0,
  tuning: 0
}
const full = {
  enabled: true,
  cleanup: 1,
  clarity: 1,
  warmth: 1,
  smoothness: 1,
  space: 1,
  deEss: 1,
  tuning: 1
}

const inRange = (p: PolishParams): boolean =>
  (Object.keys(PARAM_RANGES) as (keyof PolishParams)[]).every(
    (k) => p[k] >= PARAM_RANGES[k].min && p[k] <= PARAM_RANGES[k].max
  )

describe('polishParams', () => {
  it('keeps every parameter in its safe range across the whole slider travel', () => {
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const s = {
        enabled: true,
        cleanup: t,
        clarity: t,
        warmth: t,
        smoothness: t,
        space: t,
        deEss: t,
        tuning: t
      }
      expect(inRange(polishParams(s))).toBe(true)
    }
  })

  it('makes each slider move its parameters the way its name says', () => {
    const lo = polishParams(zero)
    const hi = polishParams(full)
    expect(hi.gateThresholdDb).toBeGreaterThan(lo.gateThresholdDb)
    expect(hi.presenceDb).toBeGreaterThan(lo.presenceDb)
    expect(hi.warmthDb).toBeGreaterThan(lo.warmthDb)
    expect(hi.lowCutHz).toBeLessThan(lo.lowCutHz)
    expect(hi.compThresholdDb).toBeLessThan(lo.compThresholdDb)
    expect(hi.compRatio).toBeGreaterThan(lo.compRatio)
    expect(hi.deEssThresholdDb).toBeLessThan(lo.deEssThresholdDb)
    expect(hi.reverbMix).toBeGreaterThan(lo.reverbMix)
  })

  it('adds makeup gain as the compressor works harder, but not more than it removes', () => {
    const p = polishParams(full)
    expect(p.makeupDb).toBeGreaterThan(polishParams(zero).makeupDb)
    expect(p.makeupDb).toBeLessThan(-p.compThresholdDb * (1 - 1 / p.compRatio))
  })

  it('has no reverb with Space at zero', () => {
    expect(polishParams(zero).reverbMix).toBe(0)
  })

  it('lets Advanced override a single parameter while the rest follow the sliders', () => {
    const base = defaultPolish()
    const p = polishParams({ ...base, advanced: { compRatio: 3 } })
    expect(p.compRatio).toBe(3)
    expect(p.presenceDb).toBe(polishParams(base).presenceDb)
  })

  it('clamps Advanced values that would sound broken', () => {
    const p = polishParams({
      ...defaultPolish(),
      advanced: { compRatio: 50, reverbMix: 2, lowCutHz: 5 }
    })
    expect(p.compRatio).toBe(8)
    expect(p.reverbMix).toBe(0.6)
    expect(p.lowCutHz).toBe(40)
  })
})

describe('defaultPolish', () => {
  it('sits harmonies further back than the lead', () => {
    const lead = defaultPolish('lead')
    const harmony = defaultPolish('harmony')
    expect(harmony.clarity).toBeLessThan(lead.clarity)
    expect(harmony.space).toBeGreaterThan(lead.space)
    expect(harmony.smoothness).toBeGreaterThan(lead.smoothness)
  })
})

describe('builtInMakeupDb', () => {
  it('matches the spec: 60% of the gain reduction at full scale', () => {
    // Threshold -20 dB, ratio 4: a 0 dBFS input comes out at -15 dB, so 0.6 × 15 dB.
    expect(builtInMakeupDb(-20, 4)).toBeCloseTo(9)
  })

  it('is zero when the compressor does nothing', () => {
    expect(builtInMakeupDb(-20, 1)).toBe(0)
  })
})
