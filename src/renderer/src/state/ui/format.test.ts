import { describe, expect, it } from 'vitest'
import { formatClock, formatDuration, formatMillis } from './format'

describe('formatMillis', () => {
  it.each([
    [0, '.000'],
    [12.3456, '.345'],
    [0.07, '.070'],
    [-1, '.000']
  ])('%d s ends %s', (seconds, text) => {
    expect(formatMillis(seconds)).toBe(text)
  })
})

describe('formatDuration', () => {
  it.each([
    [0, '0:00'],
    [9.9, '0:09'],
    [65, '1:05'],
    [-1, '0:00']
  ])('%d s is %s', (seconds, text) => {
    expect(formatDuration(seconds)).toBe(text)
  })
})

describe('formatClock', () => {
  it.each([
    [0, '00:00'],
    [9.9, '00:09'],
    [65, '01:05'],
    [3725, '62:05'],
    [-1, '00:00']
  ])('%d s reads %s on the timer', (seconds, text) => {
    expect(formatClock(seconds)).toBe(text)
  })
})
