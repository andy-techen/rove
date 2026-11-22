import { describe, expect, it } from 'vitest'
import { gainToSlider, sliderToGain } from './mixer'

describe('volume slider mapping', () => {
  it('is silent at the bottom', () => {
    expect(sliderToGain(0)).toBe(0)
    expect(gainToSlider(0)).toBe(0)
  })

  it('puts unity gain a little over 85% of the way up', () => {
    expect(gainToSlider(1)).toBeCloseTo(40 / 46, 5)
    expect(sliderToGain(40 / 46)).toBeCloseTo(1, 5)
  })

  it('tops out at +6 dB', () => {
    expect(sliderToGain(1)).toBeCloseTo(1.995, 2)
  })

  it('round-trips', () => {
    for (const g of [0.05, 0.3, 0.7, 1, 1.5])
      expect(sliderToGain(gainToSlider(g))).toBeCloseTo(g, 6)
  })

  it('clamps gains beyond the slider range', () => {
    expect(gainToSlider(10)).toBe(1)
    expect(gainToSlider(0.0001)).toBe(0)
  })
})
