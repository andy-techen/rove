import { describe, expect, it } from 'vitest'
import { detectKey, keyFromChroma, nearestNote, scaleOf } from './key'
import { midiToHz } from './pitch'

const SR = 48000
const C = 0
const A = 9

/** Notes (MIDI numbers) played one after another, each for `noteSec`, as soft sines. */
function melody(notes: number[], noteSec = 0.4): Float32Array {
  const per = Math.round(noteSec * SR)
  const out = new Float32Array(notes.length * per)
  notes.forEach((note, n) => {
    const hz = midiToHz(note)
    for (let i = 0; i < per; i++) out[n * per + i] = 0.2 * Math.sin((2 * Math.PI * hz * i) / SR)
  })
  return out
}

describe('musical keys', () => {
  it('lists the notes of a key', () => {
    expect(scaleOf({ tonic: C, mode: 'major' })).toEqual([0, 2, 4, 5, 7, 9, 11])
    expect(scaleOf({ tonic: A, mode: 'minor' })).toEqual([0, 2, 4, 5, 7, 9, 11])
    expect(scaleOf(null)).toHaveLength(12)
  })

  it('snaps to the nearest note in the key', () => {
    const cMajor = scaleOf({ tonic: C, mode: 'major' })
    // 61.4 is a sharp C♯; C♯ isn't in C major, and D (62) is nearer than C (60).
    expect(nearestNote(61.4, cMajor)).toBe(62)
    expect(nearestNote(60.3, cMajor)).toBe(60)
    expect(nearestNote(61.4, scaleOf(null))).toBe(61)
  })

  it('reads a key from how much each note sounds', () => {
    // The C major triad loudest, the rest of the scale softer, nothing outside it.
    const chroma = [10, 0, 4, 0, 8, 4, 0, 9, 0, 4, 0, 3]
    expect(keyFromChroma(chroma)).toEqual({ tonic: C, mode: 'major' })
    expect(keyFromChroma(new Array(12).fill(0))).toBeNull()
  })

  it('hears the key of a tune', async () => {
    // A minor: A C E around the tonic, with passing notes from its scale.
    const tune = melody([57, 60, 64, 69, 64, 60, 57, 59, 60, 62, 64, 57, 52, 57, 69, 57])
    expect(await detectKey([{ channels: [tune], sampleRate: SR }])).toEqual({
      tonic: A,
      mode: 'minor'
    })
  })

  it('finds no key in silence', async () => {
    expect(await detectKey([{ channels: [new Float32Array(SR)], sampleRate: SR }])).toBeNull()
  })
})
