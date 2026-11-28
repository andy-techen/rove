import { describe, expect, it } from 'vitest'
import { CHORD_QUALITIES, Chord, ChordSegment } from '../../../audio/music/chords'
import { ChordFeel } from '../../song/project'
import { pianoChord, pianoEvents, pianoVoicing } from './pianoPart'
import { PIANO_RANGE } from './constants'

const C: Chord = { root: 0, quality: 'major' }
const G: Chord = { root: 7, quality: 'major' }

// Two bars of 4/4 at 60 bpm: C, then G.
const twoBars = (
  chords: ChordSegment[] = [
    { start: 0, end: 4, chord: C },
    { start: 4, end: 8, chord: G }
  ]
) => ({ chords, secPerBeat: 1, beatsPerBar: 4, startSec: 0, endSec: 8 })

const allBars = (feel: ChordFeel) => [feel, feel]
const timesOf = (feel: ChordFeel, timeline = twoBars()) => [
  ...new Set(pianoEvents(timeline, allBars(feel)).map((e) => e.time))
]
const BASSES = [pianoVoicing(C).bass, pianoVoicing(G).bass]
const bassTimes = (feel: ChordFeel, timeline = twoBars()) =>
  pianoEvents(timeline, allBars(feel))
    .filter((e) => BASSES.includes(e.midi))
    .map((e) => e.time)

describe('pianoVoicing', () => {
  it('puts the root low in the left hand and the chord close together above it', () => {
    const { bass, chord } = pianoVoicing(C)
    expect(bass % 12).toBe(0)
    expect(chord.map((m) => m % 12).sort()).toEqual([0, 4, 7])
    expect(Math.max(...chord) - Math.min(...chord)).toBeLessThan(12)
    expect(Math.min(...chord)).toBeGreaterThan(bass)
  })

  it('plays a slash chord’s bass note in the left hand', () => {
    expect(pianoVoicing({ root: 0, quality: 'major', bass: 4 }).bass % 12).toBe(4)
  })

  it('keeps every chord in every key inside the sampled range', () => {
    for (let root = 0; root < 12; root++)
      for (const quality of CHORD_QUALITIES) {
        const { bass, chord } = pianoVoicing({ root, quality })
        for (const midi of [bass, ...chord]) {
          expect(midi).toBeGreaterThanOrEqual(PIANO_RANGE.low)
          expect(midi).toBeLessThanOrEqual(PIANO_RANGE.high)
        }
      }
  })
})

describe('pianoEvents', () => {
  it('plays one chord over its bass each bar for "Chords", held the whole bar', () => {
    expect(timesOf('chords')).toEqual([0, 4])
    const first = pianoEvents(twoBars(), allBars('chords')).filter((e) => e.time === 0)
    expect(first.map((e) => e.midi).sort()).toEqual(
      [pianoVoicing(C).bass, ...pianoVoicing(C).chord].sort()
    )
    for (const e of first) expect(e.holdSec).toBe(4)
  })

  it('reads a strummed bar as "Chords" and a fingerpicked one as "Flowing"', () => {
    expect(timesOf('strum')).toEqual(timesOf('chords'))
    expect(timesOf('pick')).toEqual(timesOf('flowing'))
  })

  it('rolls the chord up one note a beat over the bass for "Flowing"', () => {
    const bar = pianoEvents(twoBars(), allBars('flowing')).filter((e) => e.time < 4)
    expect(bar.map((e) => e.time)).toEqual([0, 1, 2, 3])
    expect(bar[0].midi).toBe(pianoVoicing(C).bass)
    expect(bar.slice(1).map((e) => e.midi)).toEqual(pianoVoicing(C).chord)
  })

  it('lets a "Flowing" bar ring under the pedal until the bar ends', () => {
    const bar = pianoEvents(twoBars(), allBars('flowing')).filter((e) => e.time < 4)
    for (const e of bar) expect(e.time + e.holdSec).toBe(4)
  })

  it.each<ChordFeel>(['chords', 'flowing'])(
    'strikes a chord that changes partway through a bar, with "%s"',
    (feel) => {
      const split = twoBars([
        { start: 0, end: 2, chord: C },
        { start: 2, end: 8, chord: G }
      ])
      expect(bassTimes(feel, split)).toEqual([0, 2, 4])
    }
  )

  it('strikes a change between beats in waltz time when flowing', () => {
    const waltz = twoBars([
      { start: 0, end: 1.5, chord: C },
      { start: 1.5, end: 6, chord: G }
    ])
    expect(bassTimes('flowing', { ...waltz, beatsPerBar: 3, endSec: 6 })).toEqual([0, 1.5, 3])
  })

  it('stays silent where there is no chord yet', () => {
    const events = pianoEvents(
      twoBars([
        { start: 0, end: 4, chord: null },
        { start: 4, end: 8, chord: G }
      ]),
      allBars('chords')
    )
    expect(Math.min(...events.map((e) => e.time))).toBe(4)
  })
})

describe('pianoChord', () => {
  const c: Chord = { root: 0, quality: 'major' }

  it('strikes the bass and the chord together, as the piano plays it', () => {
    const { bass, chord } = pianoVoicing(c)
    const events = pianoChord(c, 1.5)
    expect(events.map((e) => e.midi).sort()).toEqual([bass, ...chord].sort())
    expect(events.every((e) => e.time === 0 && e.holdSec === 1.5)).toBe(true)
  })
})
