import { describe, expect, it } from 'vitest'
import { offersVocals } from './premiumControls'

describe('offersVocals', () => {
  it('offers removing the vocals on premium', () => {
    expect(offersVocals('premium', { state: 'with' })).toBe(true)
  })

  it('hides it on the free plan', () => {
    expect(offersVocals('free', { state: 'with' })).toBe(false)
  })

  it('still lets free put back vocals removed earlier, since that undoes, not removes', () => {
    expect(offersVocals('free', { state: 'removed' })).toBe(true)
  })
})
