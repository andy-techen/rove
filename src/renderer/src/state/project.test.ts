import { describe, expect, it } from 'vitest'
import {
  createProject,
  formatDuration,
  leadTakes,
  parseProject,
  withBackingTrack,
  withTake
} from './project'

describe('withTake', () => {
  it('creates the lead track on the first take', () => {
    const p = withTake(createProject('Song', 48000), 'audio/take-001.wav', 12.5)
    expect(p.tracks).toHaveLength(1)
    expect(p.tracks[0]).toMatchObject({ role: 'lead', name: 'Lead Vocal', volume: 1, pan: 0 })
    expect(p.tracks[0].clips[0]).toMatchObject({
      file: 'audio/take-001.wav',
      start: 0,
      offset: 0,
      duration: 12.5
    })
  })

  it('appends later takes to the same lead track without mutating the original', () => {
    const one = withTake(createProject('Song', 48000), 'audio/take-001.wav', 10)
    const two = withTake(one, 'audio/take-002.wav', 11)
    expect(leadTakes(one)).toHaveLength(1)
    expect(leadTakes(two).map((c) => c.file)).toEqual(['audio/take-001.wav', 'audio/take-002.wav'])
    expect(two.tracks).toHaveLength(1)
  })
})

describe('withBackingTrack', () => {
  it('sets the backing track at full volume, replacing any previous one', () => {
    const p = withBackingTrack(
      withBackingTrack(createProject('Song', 48000), 'audio/backing-a.mp3', 'a.mp3'),
      'audio/backing-b.mp3',
      'b.mp3'
    )
    expect(p.backingTrack).toEqual({ file: 'audio/backing-b.mp3', name: 'b.mp3', volume: 1 })
  })
})

describe('parseProject', () => {
  it('round-trips a saved project', () => {
    const p = withTake(createProject('Song', 48000), 'audio/take-001.wav', 3)
    expect(parseProject(JSON.parse(JSON.stringify(p)))).toEqual(p)
  })

  it.each([null, {}, { version: 2, name: 'x', tracks: [] }, { version: 1, name: 'x' }])(
    'rejects %j',
    (data) => {
      expect(() => parseProject(data)).toThrow(/isn't a Rove project/)
    }
  )
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
