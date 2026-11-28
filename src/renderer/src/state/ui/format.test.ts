import { describe, expect, it } from 'vitest'
import { t } from '@shared/copy'
import { DAY, HOUR } from './constants'
import { formatClock, formatDuration, formatMillis, relativeTime } from './format'

const NOW = new Date('2026-11-22T12:00:00Z').getTime()

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

describe('relativeTime', () => {
  it('labels the last few days in words', () => {
    expect(relativeTime(NOW - HOUR / 2, NOW)).toBe(t('songbook.justNow'))
    expect(relativeTime(NOW - 5 * HOUR, NOW)).toBe(t('songbook.today'))
    expect(relativeTime(NOW - 1.5 * DAY, NOW)).toBe(t('songbook.yesterday'))
    expect(relativeTime(NOW - 3 * DAY, NOW)).toBe(t('songbook.daysAgo', { days: 3 }))
  })

  it('falls back to a date beyond a week', () => {
    expect(relativeTime(NOW - 30 * DAY, NOW)).toBe(new Date(NOW - 30 * DAY).toLocaleDateString())
  })
})
