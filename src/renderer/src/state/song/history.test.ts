import { describe, expect, it } from 'vitest'
import { History, emptyHistory, pushHistory, redoHistory, undoHistory } from './history'

const start: History<number> = emptyHistory

describe('history', () => {
  it('undoes and redoes in order', () => {
    let h = pushHistory(start, 1)
    h = pushHistory(h, 2)
    const u1 = undoHistory(h, 3)!
    expect(u1.value).toBe(2)
    const u2 = undoHistory(u1.history, u1.value)!
    expect(u2.value).toBe(1)
    const r1 = redoHistory(u2.history, u2.value)!
    expect(r1.value).toBe(2)
    expect(redoHistory(r1.history, r1.value)!.value).toBe(3)
  })

  it('returns null when there is nothing to undo or redo', () => {
    expect(undoHistory(start, 1)).toBeNull()
    expect(redoHistory(start, 1)).toBeNull()
  })

  it('collapses a run of same-key edits (one slider drag) into one step, but not unkeyed ones', () => {
    const undoSteps = (edits: [number, string?][]) => {
      let h = start
      for (const [value, key] of edits) h = pushHistory(h, value, key)
      const steps: number[] = []
      for (let u = undoHistory(h, -1); u; u = undoHistory(u.history, u.value)) steps.push(u.value)
      return steps
    }
    expect(
      undoSteps([
        [0, 'volume:a'],
        [1, 'volume:a'],
        [2, 'volume:a']
      ])
    ).toEqual([0])
    expect(
      undoSteps([
        [0, 'volume:a'],
        [1, 'pan:a'],
        [2, 'volume:a']
      ])
    ).toEqual([2, 1, 0])
    expect(undoSteps([[0], [1]])).toEqual([1, 0])
  })

  it('drops the redo stack after a new edit', () => {
    const h = pushHistory(start, 1)
    const undone = undoHistory(h, 2)!
    expect(pushHistory(undone.history, undone.value).future).toEqual([])
  })

  it('caps how far back it remembers', () => {
    let h: History<number> = start
    for (let i = 0; i < 150; i++) h = pushHistory(h, i)
    expect(h.past).toHaveLength(100)
    expect(h.past[0]).toBe(50)
  })
})
