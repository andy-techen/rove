import { describe, expect, it } from 'vitest'
import { offersVocals } from './premiumControls'

describe('offersVocals', () => {
  it('offers removing vocals on premium only, but lets free put back ones removed earlier', () => {
    expect(offersVocals('premium', { state: 'with' })).toBe(true)
    expect(offersVocals('free', { state: 'with' })).toBe(false)
    // Putting vocals back undoes a removal rather than removing.
    expect(offersVocals('free', { state: 'removed' })).toBe(true)
  })
})
