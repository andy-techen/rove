import { describe, expect, it } from 'vitest'
import { timeLeft } from './timeLeft'

describe('timeLeft', () => {
  it.each([
    ['too little progress to guess', 0.02, 5, null],
    ['too soon to guess', 0.5, 0.5, null],
    ['almost done', 0.9, 45, { kind: 'soon' }],
    ['seconds, rounded up to a step', 0.5, 21, { kind: 'sec', count: 25 }],
    ['minutes, rounded up', 0.25, 50, { kind: 'min', count: 3 }]
  ])('%s', (_name, progress, elapsedSec, expected) => {
    expect(timeLeft(progress, elapsedSec)).toEqual(expected)
  })
})
