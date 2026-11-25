import { describe, expect, it } from 'vitest'
import { loopPlace } from './beatLoop'

// A bar of four at 60 bpm, a bar of count-in, then one bar to record.
const place = (heardSec: number) =>
  loopPlace(heardSec, { secPerBeat: 1, beatsPerBar: 4, countInBars: 1, bars: 1 })

describe('loopPlace', () => {
  it('counts in for the first bar', () => {
    expect(place(2)).toEqual({ counting: true, at: 2, done: false })
  })

  it('places a tap in the bar being recorded', () => {
    expect(place(5.5)).toEqual({ counting: false, at: 1.5, done: false })
  })

  it('is done once the bar has played through', () => {
    expect(place(8.01).done).toBe(true)
  })
})
