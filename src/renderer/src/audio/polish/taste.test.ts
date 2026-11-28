import { describe, expect, it } from 'vitest'
import { TasteExample } from '@shared/preferences/polishTaste'
import { ruledPolish, suggestPolish } from './autoPolish'
import { MAX_LEAN, TONE_REFERENCE } from './constants'
import { PolishReading } from './polishReading'
import { learnTaste } from './taste'

const reading: PolishReading = {
  voiceDb: -18,
  softDb: -26,
  rangeDb: 15,
  noiseDb: -61,
  hum: false,
  sibilanceDb: null,
  bodyDb: TONE_REFERENCE.bodyDb,
  presenceDb: TONE_REFERENCE.presenceDb,
  airDb: TONE_REFERENCE.airDb,
  clipped: false
}
const ruled = ruledPolish(reading, 'lead')

/** A polished track where the singer moved some knobs from what the rules set. */
function song(moved: Partial<typeof ruled>, i = 0): TasteExample {
  const kept = { ...ruled }
  for (const [key, by] of Object.entries(moved)) kept[key as keyof typeof ruled] += by
  return { trackId: `t${i}`, part: 'lead', savedAt: 1000 - i, reading, kept }
}
const songs = (n: number, moved: Partial<typeof ruled>) =>
  Array.from({ length: n }, (_, i) => song(moved, i))

describe('learnTaste', () => {
  it('learns nothing before any song was auto-polished', () => {
    expect(learnTaste([])).toEqual({})
  })

  it('leans toward where the singer keeps turning a knob', () => {
    const taste = learnTaste(songs(5, { warmth: 0.1 }))
    expect(taste.warmth).toBeGreaterThan(0.05)
    expect(taste.warmth).toBeLessThanOrEqual(0.1)
  })

  it('leans only a little after one song', () => {
    expect(learnTaste(songs(1, { warmth: 0.1 })).warmth).toBeLessThan(0.05)
  })

  it('never leans further than its limit, however far the singer turns', () => {
    expect(learnTaste(songs(20, { space: 0.5 })).space).toBe(MAX_LEAN)
  })

  it('counts newer songs for more than older ones', () => {
    const taste = learnTaste([...songs(4, { clarity: -0.1 }), ...songs(8, { clarity: 0.1 })])
    expect(taste.clarity).toBeLessThan(0)
  })

  it('leaves out knobs the singer keeps where auto polish set them', () => {
    expect(learnTaste(songs(5, { warmth: 0.1 }))).not.toHaveProperty('clarity')
  })

  it('never learns more noise reduction, which could cut soft singing on another take', () => {
    expect(learnTaste(songs(10, { cleanup: 0.2 }))).not.toHaveProperty('cleanup')
    expect(learnTaste(songs(10, { cleanup: -0.2 })).cleanup).toBeLessThan(0)
  })

  it('settles rather than growing when the singer keeps what it learned', () => {
    let taste = learnTaste(songs(5, { warmth: 0.1 }))
    for (let round = 0; round < 10; round++) {
      const kept = suggestPolish(reading, 'lead', taste).amounts
      taste = learnTaste(songs(5, { warmth: kept.warmth - ruled.warmth }))
    }
    expect(taste.warmth).toBeLessThanOrEqual(0.1)
  })

  it('leaves out the track being polished', () => {
    expect(learnTaste(songs(1, { warmth: 0.1 }), 't0')).toEqual({})
  })
})
