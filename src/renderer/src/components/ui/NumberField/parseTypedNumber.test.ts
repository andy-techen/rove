import { describe, expect, it } from 'vitest'
import { parseTypedNumber } from './parseTypedNumber'

describe('parseTypedNumber', () => {
  it.each([
    ['120', 120],
    ['−3', -3],
    ['2,5', 2.5],
    ['120 BPM', 120],
    ['lots', null]
  ])('reads %s as %s', (text, n) => {
    expect(parseTypedNumber(text)).toBe(n)
  })
})
