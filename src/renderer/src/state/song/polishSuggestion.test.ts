import { describe, expect, it } from 'vitest'
import { PolishSuggestion } from '../../audio/polish/autoPolish'
import { AUTO_POLISH_VERSION } from '../../audio/polish/constants'
import { Project, createProject, polishOf, withRecordedClip, withTrackChanges } from './project'
import { heardOf, heardWindows, suggestionIsStale, withPolishSuggestion } from './polishSuggestion'

const amounts = { cleanup: 0.2, clarity: 0.7, warmth: 0.3, smoothness: 0.6, space: 0.3, deEss: 0.5 }

function songWithTake(): Project {
  const p = createProject('Song', 48000)
  return withRecordedClip(p, p.tracks[0].id, { file: 'a.wav', start: 0, offset: 1, duration: 4 })
}

const suggestion = (p: Project): PolishSuggestion => ({
  amounts,
  reasons: ['dull'],
  heard: heardOf(p.tracks[0]),
  version: AUTO_POLISH_VERSION
})

function suggested(): Project {
  const p = songWithTake()
  return withPolishSuggestion(p, p.tracks[0].id, suggestion(p))
}

describe('withPolishSuggestion', () => {
  it('sets the knobs and keeps the switch, Tuning and Advanced', () => {
    const p = songWithTake()
    const id = p.tracks[0].id
    const custom = { ...polishOf(p.tracks[0]), enabled: false, tuning: 0.4, advanced: { airDb: 2 } }
    const before = { ...p, tracks: [{ ...p.tracks[0], polish: custom }] }
    const after = polishOf(withPolishSuggestion(before, id, suggestion(p)).tracks[0])
    expect(after).toEqual({ ...custom, ...amounts })
  })
})

describe('suggestionIsStale', () => {
  it('notices takes that changed since Rove listened', () => {
    const p = suggested()
    expect(suggestionIsStale(p.tracks[0])).toBe(false)
    const more = withRecordedClip(p, p.tracks[0].id, {
      file: 'b.wav',
      start: 9,
      offset: 0,
      duration: 2
    })
    expect(suggestionIsStale(more.tracks[0])).toBe(true)
  })
})

describe('changing a vocal part', () => {
  it('drops the suggestion made for the other part, and leaves the knobs alone', () => {
    const p = suggested()
    const next = withTrackChanges(p, p.tracks[0].id, { part: 'harmony' })
    expect(next.tracks[0].polishSuggestion).toBeUndefined()
    expect(next.tracks[0].polish).toEqual(p.tracks[0].polish)
  })
})

describe('heardWindows', () => {
  it('lists the played part of each take whose audio is loaded', () => {
    const p = withRecordedClip(songWithTake(), songWithTake().tracks[0].id, {
      file: 'gone.wav',
      start: 8,
      offset: 0,
      duration: 1
    })
    const audio = { 'a.wav': {} as AudioBuffer }
    expect(heardWindows(p.tracks[0], audio)).toEqual([
      { audio: audio['a.wav'], offsetSec: 1, durationSec: 4 }
    ])
  })
})
