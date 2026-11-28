import { TakeRef } from '@shared/songs/voice'
import { describe, expect, it } from 'vitest'
import { emptySummary } from '../../audio/voice/summary'
import type { Entry } from '../../audio/voice'
import { MUSIC_SEMITONES_MAX as MAX } from '../song/project'
import { keySuggestion, suggestedShift } from './keyFit'

describe('suggestedShift', () => {
  it.each([
    // song range at the original key, comfort zone, current shift → suggestion
    ['too high: down until it fits', { low: 57, high: 69 }, { low: 52, high: 65 }, 0, -4],
    ['too low: up until it fits', { low: 45, high: 57 }, { low: 50, high: 62 }, 0, 5],
    ['already fits', { low: 55, high: 64 }, { low: 52, high: 65 }, 0, null],
    ['fits at the current shift', { low: 57, high: 69 }, { low: 52, high: 65 }, -4, null],
    ['one note over is not worth a change', { low: 55, high: 66 }, { low: 52, high: 65 }, 0, null],
    ['wider than the zone: centred', { low: 50, high: 72 }, { low: 52, high: 64 }, 6, -3],
    ['out of reach: as far as the knob goes', { low: 70, high: 80 }, { low: 50, high: 62 }, 0, -MAX]
  ])('%s', (_, song, zone, current, expected) => {
    expect(suggestedShift(song, zone, current)).toBe(expected)
  })
})

const entry = (folder: string, notes: Record<number, number>, semitones = 0): Entry => ({
  ref: {
    folder,
    songName: folder,
    file: `audio/${folder}-${semitones}.wav`,
    offsetSec: 0,
    durationSec: 0,
    part: 'lead',
    semitones,
    recordedAt: 0
  } satisfies TakeRef,
  summary: {
    ...emptySummary(),
    sungSec: Object.values(notes).reduce((a, b) => a + b, 0),
    noteSec: notes
  }
})

// Other songs put the comfort zone around C3–C4 (48–60).
const elsewhere = [entry('other', { 48: 30, 54: 40, 60: 30 })]

describe('keySuggestion', () => {
  it('suggests a lower key when this song sits above the comfort zone', () => {
    const here = entry('this', { 55: 10, 62: 10, 67: 10 })
    // It would fit 7 down; the knob stops at 6.
    expect(keySuggestion([...elsewhere, here], 'this', 0)).toEqual({
      semitones: -MAX,
      sung: { low: 55, high: 67 },
      zone: { low: 48, high: 60 }
    })
  })

  it('reads each take in the key it was sung in', () => {
    // Sung four down, and it fits; read as if sung at the original key, it would seem low.
    const lowered = entry('this', { 50: 10, 55: 10, 58: 10 }, -4)
    expect(keySuggestion([...elsewhere, lowered], 'this', -4)).toBeNull()
  })

  it('waits for enough singing, here and elsewhere', () => {
    const here = entry('this', { 67: 5 })
    expect(keySuggestion([...elsewhere, here], 'this', 0)).toBeNull()
    expect(keySuggestion([entry('this', { 55: 10, 62: 10, 67: 10 })], 'this', 0)).toBeNull()
  })

  it('leaves harmonies out', () => {
    const harmony = entry('this', { 64: 10, 67: 10, 71: 10 })
    harmony.ref.part = 'harmony'
    expect(keySuggestion([...elsewhere, harmony], 'this', 0)).toBeNull()
  })
})
