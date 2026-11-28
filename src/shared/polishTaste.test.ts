import { describe, expect, it } from 'vitest'
import { heardOfClips, tasteExamplesOf } from './polishTaste'

const reading = {
  voiceDb: -18,
  softDb: -26,
  rangeDb: 15,
  noiseDb: -61,
  hum: false,
  sibilanceDb: null,
  bodyDb: 10,
  presenceDb: -8,
  airDb: -25,
  clipped: false
}
const clips = [{ id: 'c', file: 'audio/take-001.wav', start: 0, offset: 0, duration: 5 }]
const polish = {
  enabled: true,
  cleanup: 0.5,
  clarity: 0.5,
  warmth: 0.6,
  smoothness: 0.5,
  space: 0.3,
  deEss: 0.4,
  tuning: 0
}

/** A song with one vocal track auto polish set, changed as given. */
function song(track: Record<string, unknown> = {}) {
  const suggestion = { amounts: {}, reasons: [], heard: heardOfClips(clips), version: 1, reading }
  return {
    tracks: [
      {
        id: 'v1',
        role: 'vocal',
        part: 'lead',
        clips,
        polish,
        polishSuggestion: suggestion,
        ...track
      }
    ]
  }
}

describe('tasteExamplesOf', () => {
  it('reads where the singer left the knobs on a polished track', () => {
    const [example] = tasteExamplesOf(song(), 42)
    expect(example).toMatchObject({ trackId: 'v1', part: 'lead', savedAt: 42, reading })
    expect(example.kept.warmth).toBe(0.6)
  })

  it('skips a track whose takes changed since auto polish listened', () => {
    const changed = [{ ...clips[0], duration: 3 }]
    expect(tasteExamplesOf(song({ clips: changed }), 0)).toEqual([])
  })

  it('skips a track with Polish switched off, which the singer may be comparing', () => {
    expect(tasteExamplesOf(song({ polish: { ...polish, enabled: false } }), 0)).toEqual([])
  })

  it('skips suggestions from before Rove kept what it heard', () => {
    const old = { amounts: {}, reasons: [], heard: heardOfClips(clips), version: 1 }
    expect(tasteExamplesOf(song({ polishSuggestion: old }), 0)).toEqual([])
  })

  it('skips knobs that are out of range or missing', () => {
    expect(tasteExamplesOf(song({ polish: { ...polish, warmth: 7 } }), 0)).toEqual([])
    expect(tasteExamplesOf(null, 0)).toEqual([])
  })
})
