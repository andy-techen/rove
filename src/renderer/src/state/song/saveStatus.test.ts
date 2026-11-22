import { describe, expect, it } from 'vitest'
import { saveLabel } from './saveStatus'

const MIN = 60_000
// One fixed clock, so a millisecond ticking mid-test can't change the label.
const now = Date.now()
const saved = (msAgo: number) => ({ status: 'saved' as const, at: now - msAgo })

describe('saveLabel', () => {
  it('reads naturally as time passes', () => {
    expect(saveLabel(saved(2_000), now)).toBe('Saved just now')
    expect(saveLabel(saved(30_000), now)).toBe('Saved less than a minute ago')
    expect(saveLabel(saved(5 * MIN), now)).toBe('Saved 5 min ago')
    expect(saveLabel(saved(3 * 60 * MIN), now)).toMatch(/^Saved at /)
  })

  it('says when a change is waiting to save, or failed to', () => {
    expect(saveLabel({ status: 'saving' }, now)).toBe('Saving…')
    expect(saveLabel({ status: 'failed' }, now)).toBe('Not saved')
  })
})
