import { describe, expect, it } from 'vitest'
import { cycleState } from './features'

describe('cycleState', () => {
  it('marks the item at the step as now, earlier ones past and later ones ahead', () => {
    expect([0, 1, 2, 3].map((i) => cycleState(i, 2, 4))).toEqual(['past', 'past', 'now', 'ahead'])
  })

  it('starts over after the last item, with nothing past', () => {
    expect([0, 1, 2].map((i) => cycleState(i, 3, 3))).toEqual(['now', 'ahead', 'ahead'])
  })
})
