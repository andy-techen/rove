import { describe, expect, it } from 'vitest'
import { indexForSlot, moveItem } from './tabOrder'

describe('moveItem', () => {
  it('moves an item right or left', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
    expect(moveItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b'])
  })

  it('leaves the list alone for a move off either end', () => {
    expect(moveItem(['a', 'b'], 0, -1)).toEqual(['a', 'b'])
    expect(moveItem(['a', 'b'], 1, 2)).toEqual(['a', 'b'])
  })
})

describe('indexForSlot', () => {
  it('accounts for the dragged item leaving its own place', () => {
    // Dropped in the gap before item 3: lands at 2 once item 0 has moved out.
    expect(indexForSlot(0, 3)).toBe(2)
    expect(indexForSlot(2, 0)).toBe(0)
  })
})
