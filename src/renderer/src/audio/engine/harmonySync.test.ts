import { describe, expect, it } from 'vitest'
import { harmonyTiming, phrasesOf } from './harmonySync'

const RATE = 8000
const SONG_SEC = 10

/** Sung syllables (rising and falling tones) of the given lengths, back to back from `at`. */
function sing(out: Float32Array, at: number, syllables: number[], hz: number): void {
  let t = at
  for (const length of syllables) {
    const from = Math.round(t * RATE)
    const n = Math.round(length * RATE)
    for (let i = 0; i < n && from + i < out.length; i++) {
      const swell = Math.sin((Math.PI * i) / n)
      out[from + i] += 0.3 * swell * Math.sin((2 * Math.PI * hz * (from + i)) / RATE)
    }
    t += length + 0.04
  }
}

// Two phrases with uneven syllables, like words, so no shift matches by accident.
const VERSE = [0.18, 0.31, 0.12, 0.26, 0.2, 0.15]
const CHORUS = [0.25, 0.12, 0.35, 0.16, 0.22]

function voice(hz: number, verseAt = 1, chorusAt = 4.5): Float32Array {
  const out = new Float32Array(SONG_SEC * RATE)
  sing(out, verseAt, VERSE, hz)
  sing(out, chorusAt, CHORUS, hz)
  return out
}

describe('phrasesOf', () => {
  it('finds each phrase sung between pauses, not each syllable', () => {
    const phrases = phrasesOf(voice(220), RATE)
    expect(phrases).toHaveLength(2)
    expect(phrases[0].from).toBeCloseTo(1, 1)
    expect(phrases[1].from).toBeCloseTo(4.5, 1)
  })
})

describe('harmonyTiming', () => {
  it('hears how far each harmony phrase sits from the lead', () => {
    const timing = harmonyTiming(voice(277, 1.12, 4.42), voice(220), RATE)
    expect(timing?.map((p) => p.bySec)).toEqual([expect.closeTo(0.12, 2), expect.closeTo(-0.08, 2)])
  })

  it('leaves a phrase that is already with the lead where it is', () => {
    const timing = harmonyTiming(voice(277, 1.12, 4.5), voice(220), RATE)
    expect(timing?.[0].bySec).toBeCloseTo(0.12, 2)
    expect(timing?.[1].bySec).toBe(0)
  })

  it('offers nothing when the harmony is already with the lead', () => {
    expect(harmonyTiming(voice(277), voice(220), RATE)).toBeNull()
  })

  it('makes no guess where the lead is not singing', () => {
    const silent = new Float32Array(SONG_SEC * RATE)
    expect(harmonyTiming(voice(277, 1.12, 4.42), silent, RATE)).toBeNull()
  })
})
