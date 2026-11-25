import { LANDING_BINS, TakeRef, TakeSummary } from '@shared/voice'
import { describe, expect, it } from 'vitest'
import { byMonth, bySong, combine, profileOf } from './profile'
import { emptySummary } from './summary'

const summary = (changes: Partial<TakeSummary> = {}): TakeSummary => ({
  ...emptySummary(),
  ...changes
})

const ref = (folder: string, recordedAt: Date): TakeRef => ({
  folder,
  songName: folder,
  file: 'audio/take-001.wav',
  offsetSec: 0,
  durationSec: 0,
  part: 'lead',
  recordedAt: recordedAt.getTime()
})
const entry = (folder: string, recordedAt: Date, sungSec = 1) => ({
  ref: ref(folder, recordedAt),
  summary: summary({ sungSec })
})

// Bin 10 is 0–5 cents sharp; bin 0 is 45–50 cents flat.
const landing = (bins: Record<number, number>): number[] =>
  Array.from({ length: LANDING_BINS }, (_, i) => bins[i] ?? 0)

describe('combine', () => {
  it('adds every field together', () => {
    const a = summary({
      sungSec: 2,
      noteSec: { 60: 2 },
      lowestNote: 55,
      highestNote: 67,
      landing: landing({ 10: 1 })
    })
    const b = summary({
      sungSec: 3,
      noteSec: { 60: 1, 62: 2 },
      lowestNote: 52,
      highestNote: 64,
      landing: landing({ 10: 2 })
    })
    const both = combine([a, b])
    expect(both).toMatchObject({
      sungSec: 5,
      noteSec: { 60: 3, 62: 2 },
      lowestNote: 52,
      highestNote: 67
    })
    expect(both.landing[10]).toBe(3)
  })

  it('keeps a range when one summary held no notes', () => {
    const both = combine([summary(), summary({ lowestNote: 50, highestNote: 60 })])
    expect([both.lowestNote, both.highestNote]).toEqual([50, 60])
  })
})

describe('profileOf', () => {
  it('puts the comfort zone where all but the outer 5% of sung time sits', () => {
    const noteSec = { 40: 1, 48: 20, 55: 58, 60: 20, 72: 1 }
    const profile = profileOf(summary({ sungSec: 100, noteSec }))
    expect([profile.comfortLow, profile.comfortHigh, profile.mostUsedNote]).toEqual([48, 60, 55])
  })

  it('counts held notes within 20 cents as landed', () => {
    const profile = profileOf(summary({ landing: landing({ 6: 1, 13: 1, 14: 1, 0: 1 }) }))
    expect(profile.landedShare).toBe(0.5)
  })

  it('has no tone, range or landing before anything is sung', () => {
    expect(profileOf(emptySummary())).toMatchObject({
      comfortLow: null,
      landedShare: null,
      tone: null
    })
  })

  it('places a brighter voice higher on clarity', () => {
    const tone = (presence: number) => ({ body: 1, mid: 1, presence, air: 0.01, frames: 10 })
    const dull = profileOf(summary({ tone: tone(0.1) })).tone
    const bright = profileOf(summary({ tone: tone(1) })).tone
    expect(bright!.clarity).toBeGreaterThan(dull!.clarity)
    expect(bright!.clarity).toBeLessThanOrEqual(1)
  })
})

describe('byMonth', () => {
  it('includes empty months between the first and last, oldest first', () => {
    const months = byMonth([
      entry('a', new Date(2026, 2, 31)),
      entry('a', new Date(2025, 11, 2), 2)
    ])
    expect(months.map((m) => [m.year, m.month])).toEqual([
      [2025, 11],
      [2026, 0],
      [2026, 1],
      [2026, 2]
    ])
    expect(months.map((m) => m.summary.sungSec)).toEqual([2, 0, 0, 1])
  })
})

describe('bySong', () => {
  it('orders songs by when each was first recorded', () => {
    const songs = bySong([
      entry('later', new Date(2026, 5, 1)),
      entry('earlier', new Date(2026, 6, 1)),
      entry('earlier', new Date(2026, 1, 1))
    ])
    expect(songs.map((s) => [s.folder, s.summary.sungSec])).toEqual([
      ['earlier', 2],
      ['later', 1]
    ])
  })
})
