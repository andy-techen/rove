import { describe, expect, it } from 'vitest'
import {
  BarBeat,
  BeatPart,
  Project,
  createProject,
  withSongBeats,
  withSongTempo
} from '../../song/project'
import { barGrid } from '../chart/chart'
import { barsUntil, beatCells, beatHits, hitsFrom, placeTap, withHit } from './beats'

/** A song at 60 bpm, so a beat is a second. */
const song = (beatsPerBar: 3 | 4 = 4): Project =>
  withSongTempo(withSongBeats(createProject('Song', 48000), beatsPerBar), 60)

const hitsOf = (parts: BeatPart[], beatsPerBar: 3 | 4 = 4) =>
  beatHits(barGrid(song(beatsPerBar), parts.length)!, { groove: 'pop', parts })
const near = (time: number) => (h: { time: number }) => Math.abs(h.time - time) < 0.01
const voicesAt = (parts: BeatPart[], time: number, beatsPerBar: 3 | 4 = 4) =>
  hitsOf(parts, beatsPerBar)
    .filter(near(time))
    .map((h) => h.voice)
    .sort()

describe('beatHits', () => {
  it('plays kick on one and three and snare on two and four', () => {
    expect(voicesAt(['main'], 0)).toEqual(['hat', 'kick'])
    expect(voicesAt(['main'], 1)).toEqual(['hat', 'snare'])
    expect(voicesAt(['main'], 2)).toEqual(['hat', 'kick'])
  })

  it('counts a waltz in threes', () => {
    expect(voicesAt(['main', 'main'], 3, 3)).toEqual(['hat', 'kick'])
    expect(voicesAt(['main'], 2, 3)).toEqual(['hat', 'snare'])
  })

  it('stays silent through a rest bar', () => {
    const hits = hitsOf(['main', 'rest', 'main'])
    expect(hits.some((h) => h.time > 4.01 && h.time < 7.99)).toBe(false)
  })

  it('plays softer in a quiet bar and busier in a big one', () => {
    const loudness = (part: BeatPart) => hitsOf([part]).reduce((sum, h) => sum + h.velocity, 0)
    expect(loudness('quiet')).toBeLessThan(loudness('main'))
    expect(loudness('big')).toBeGreaterThan(loudness('main'))
  })

  it('runs down the snare in the second half of a fill', () => {
    const snares = hitsOf(['fill']).filter((h) => h.voice === 'snare' && h.time >= 1.99)
    expect(snares.length).toBe(8)
  })

  it('loosens each hit only a little, the same way every time', () => {
    expect(hitsOf(['main', 'big'])).toEqual(hitsOf(['main', 'big']))
    for (const h of hitsOf(['main'])) {
      expect(Math.abs(h.time * 2 - Math.round(h.time * 2))).toBeLessThan(0.01)
      expect(h.velocity).toBeLessThanOrEqual(1)
    }
  })
})

describe('barsUntil', () => {
  it('counts the bars it takes to reach the end of the song', () => {
    expect(barsUntil(song(), 16)).toBe(4)
    expect(barsUntil(song(), 16.5)).toBe(5)
  })
})

describe('beatCells', () => {
  it('lays each bar on the timeline with its part', () => {
    const cells = beatCells(song(), { groove: 'pop', parts: ['main', 'fill'] })
    expect(cells.map((c) => [c.start, c.end, c.part])).toEqual([
      [0, 4, 'main'],
      [4, 8, 'fill']
    ])
  })
})

describe('a beat of your own', () => {
  const hits = [
    { drum: 'kick', at: 0 },
    { drum: 'kick', at: 1.5 },
    { drum: 'clap', at: 2 },
    { drum: 'crash', at: 3.75 }
  ] as const
  const mine = (parts: BarBeat[]) =>
    beatHits(barGrid(song(), parts.length)!, {
      groove: 'pop',
      parts,
      mine: [{ n: 1, hits: [...hits] }]
    })

  it('plays each drum where it was put in the bar', () => {
    const at = mine(['mine-1']).map((h) => [Math.round(h.time * 4) / 4, h.voice])
    expect(at).toEqual([
      [0, 'kick'],
      [1.5, 'kick'],
      [2, 'clap'],
      [3.75, 'crash']
    ])
  })

  it('starts from what the bar played before', () => {
    const main = hitsFrom({ groove: 'pop', parts: ['main'] }, 4, 'main')
    const at = (drum: string) => main.filter((h) => h.drum === drum).map((h) => h.at)
    expect(at('kick')).toEqual([0, 2])
    expect(at('snare')).toEqual([1, 3])
  })
})

describe('placeTap', () => {
  it('snaps a tap to the nearest sixteenth, or leaves it as played', () => {
    expect(placeTap(1.07, 4, true)).toBe(1)
    expect(placeTap(1.2, 4, true)).toBe(1.25)
    expect(placeTap(1.07, 4, false)).toBe(1.07)
  })

  it('brings a tap just before the bar line round to its start', () => {
    expect(placeTap(3.95, 4, true)).toBe(0)
  })
})

describe('withHit', () => {
  it('adds a hit once, however often that drum is tapped there', () => {
    const one = withHit([], { drum: 'snare', at: 1 })
    expect(withHit(one, { drum: 'snare', at: 1.01 })).toBe(one)
    expect(withHit(one, { drum: 'kick', at: 1 })).toHaveLength(2)
  })
})
