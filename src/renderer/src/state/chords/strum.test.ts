import { describe, expect, it } from 'vitest'
import { ChordSegment } from '../../audio/music/chords'
import { eventsFor, guitarNotes, strumEvents } from './strum'

const C = { root: 0, quality: 'major' } as const
const G = { root: 7, quality: 'major' } as const

// Two bars of 4/4 at 60 bpm: C, then G.
const twoBars = (
  chords: ChordSegment[] = [
    { start: 0, end: 4, chord: C },
    { start: 4, end: 8, chord: G }
  ]
) => ({ chords, secPerBeat: 1, beatsPerBar: 4, startSec: 0, endSec: 8 })

describe('strumEvents', () => {
  it('strums down, down-up, up-down-up in every bar of four', () => {
    const events = strumEvents(twoBars())
    expect(events.slice(0, 6).map((e) => [e.time, e.direction])).toEqual([
      [0, 'down'],
      [1, 'down'],
      [1.5, 'up'],
      [2.5, 'up'],
      [3, 'down'],
      [3.5, 'up']
    ])
    expect(events).toHaveLength(12)
  })

  it('plays each chord in its own bar, and strikes a new chord harder', () => {
    const events = strumEvents(twoBars())
    const atFour = events.find((e) => e.time === 4)!
    expect(atFour.notes).toEqual(guitarNotes(G))
    expect(atFour.velocity).toBeGreaterThan(events.find((e) => e.time === 5)!.velocity)
  })

  it('stays silent where there is no chord yet', () => {
    const events = strumEvents(
      twoBars([
        { start: 0, end: 4, chord: null },
        { start: 4, end: 8, chord: G }
      ])
    )
    expect(Math.min(...events.map((e) => e.time))).toBe(4)
  })

  it('strums only the top strings on the way up, high to low', () => {
    const up = strumEvents(twoBars()).find((e) => e.direction === 'up')!
    expect(up.notes.every((n) => n.string >= 2)).toBe(true)
    expect(up.notes[0].midi).toBeGreaterThan(up.notes.at(-1)!.midi)
  })

  it('counts three to a bar in waltz time', () => {
    const waltz = { ...twoBars(), beatsPerBar: 3, endSec: 6 }
    expect(
      strumEvents(waltz)
        .filter((e) => e.time < 3)
        .map((e) => e.time)
    ).toEqual([0, 1, 1.5, 2, 2.5])
  })
})

describe('guitarNotes', () => {
  it('puts a slash chord’s bass note under the chord', () => {
    // C/E: E on the low string, then the C chord above it.
    const notes = guitarNotes({ root: 0, quality: 'major', bass: 4 })
    expect(notes[0]).toEqual({ string: 0, midi: 40 })
    expect(notes.slice(1).every((n) => [0, 4, 7].includes(n.midi % 12))).toBe(true)
  })
})

describe('fingerpicking', () => {
  const picked = () => eventsFor(twoBars(), ['pick', 'pick'])

  it('picks one string at a time on every half beat, the bass on the beat', () => {
    const events = picked()
    expect(events).toHaveLength(16)
    expect(events.every((e) => e.notes.length === 1)).toBe(true)
    expect(events.slice(0, 4).map((e) => e.time)).toEqual([0, 0.5, 1, 1.5])
    expect(events[0].notes[0]).toEqual(guitarNotes(C)[0])
  })

  it('plays T 1 2 1 3 1 2 1 over the top three strings', () => {
    const [one, two, three] = guitarNotes(C)
      .slice(-3)
      .map((n) => n.string)
    const strings = picked()
      .slice(1, 8)
      .map((e) => e.notes[0].string)
    expect(strings).toEqual([one, two, one, three, one, two, one])
  })

  it('starts a new chord on its bass', () => {
    expect(picked()[8].notes[0]).toEqual(guitarNotes(G)[0])
  })

  it('plays each bar its own way', () => {
    const mixed = eventsFor(twoBars(), ['strum', 'pick'])
    expect(mixed.filter((e) => e.time < 4)).toEqual(strumEvents(twoBars()).slice(0, 6))
    expect(mixed.filter((e) => e.time >= 4).every((e) => e.notes.length === 1)).toBe(true)
  })
})
