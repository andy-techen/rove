import { describe, expect, it } from 'vitest'
import { isEnabled, parsePlan, requireFeature } from './features'
import { PREMIUM_FEATURES } from './premiumFeatures'

describe('isEnabled', () => {
  it('keeps every premium feature for premium', () => {
    for (const feature of PREMIUM_FEATURES) {
      expect(isEnabled(feature, 'free')).toBe(false)
      expect(isEnabled(feature, 'premium')).toBe(true)
    }
  })
})

describe('requireFeature', () => {
  it('stops work on a feature the plan does not include', () => {
    expect(() => requireFeature('autoPolish', 'free')).toThrow(/autoPolish/)
    expect(() => requireFeature('autoPolish', 'premium')).not.toThrow()
  })
})

describe('parsePlan', () => {
  it('falls back to free for anything it does not know', () => {
    expect(parsePlan('premium')).toBe('premium')
    expect(parsePlan('gold')).toBe('free')
    expect(parsePlan(undefined)).toBe('free')
  })
})
