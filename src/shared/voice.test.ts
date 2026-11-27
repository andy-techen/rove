import { describe, expect, it } from 'vitest'
import {
  LANDING_BINS,
  TakeSummary,
  VOICE_ANALYSIS_VERSION,
  parseVoiceCache,
  vocalClipsOf
} from './voice'

const clip = (file: string, offset = 0, duration = 4) => ({
  id: file,
  file,
  start: 0,
  offset,
  duration
})

describe('vocalClipsOf', () => {
  it('lists vocal clips only, keeping each track’s part', () => {
    const manifest = {
      version: 2,
      tracks: [
        { role: 'backing', clips: [clip('audio/backing-song.mp3')] },
        { role: 'vocal', part: 'lead', clips: [clip('audio/take-001.wav', 1, 3)] },
        { role: 'vocal', part: 'harmony', clips: [clip('audio/take-002.wav')] },
        { role: 'chords', clips: [] }
      ]
    }
    expect(vocalClipsOf(manifest)).toEqual([
      { file: 'audio/take-001.wav', offsetSec: 1, durationSec: 3, part: 'lead' },
      { file: 'audio/take-002.wav', offsetSec: 0, durationSec: 4, part: 'harmony' }
    ])
  })

  it('treats a vocal track without a part as lead, as older projects saved them', () => {
    const manifest = {
      version: 2,
      tracks: [{ role: 'vocal', clips: [clip('audio/take-001.wav')] }]
    }
    expect(vocalClipsOf(manifest)[0].part).toBe('lead')
  })

  it('reads version 1 projects, whose tracks held only takes', () => {
    const manifest = { version: 1, tracks: [{ clips: [clip('audio/take-001.wav')] }] }
    expect(vocalClipsOf(manifest)).toHaveLength(1)
  })

  it('counts a clip copied elsewhere on the timeline once', () => {
    const copy = { ...clip('audio/take-001.wav'), start: 30 }
    const manifest = {
      version: 2,
      tracks: [{ role: 'vocal', clips: [clip('audio/take-001.wav'), copy] }]
    }
    expect(vocalClipsOf(manifest)).toHaveLength(1)
  })

  it('skips malformed clips and anything that is not a project', () => {
    const bad = [{ file: 3 }, { file: 'audio/take-001.wav', offset: -1 }, null]
    expect(vocalClipsOf({ version: 2, tracks: [{ role: 'vocal', clips: bad }] })).toEqual([])
    expect(vocalClipsOf(null)).toEqual([])
  })
})

const summary = (): TakeSummary => ({
  sungSec: 12,
  recordedSec: 20,
  noteSec: { 60: 4, 62: 8 },
  lowestNote: 60,
  highestNote: 62,
  landing: Array(LANDING_BINS).fill(1),
  tone: { body: 1, mid: 2, presence: 3, air: 4, frames: 10 }
})
const entry = (overrides: Record<string, unknown> = {}) => ({
  folder: 'Fly Away',
  file: 'audio/take-001.wav',
  offsetSec: 0,
  durationSec: 5,
  version: VOICE_ANALYSIS_VERSION,
  summary: summary(),
  ...overrides
})

describe('parseVoiceCache', () => {
  it('keeps well-formed entries, including ones where no note was held', () => {
    const quiet = entry({ summary: { ...summary(), lowestNote: null, highestNote: null } })
    expect(parseVoiceCache([entry(), quiet])).toEqual([entry(), quiet])
  })

  it.each([
    ['a missing folder', entry({ folder: '' })],
    ['a negative offset', entry({ offsetSec: -1 })],
    ['a non-finite duration', entry({ durationSec: Infinity })],
    ['the wrong number of landing bins', entry({ summary: { ...summary(), landing: [1, 2] } })],
    [
      'a negative landing count',
      entry({ summary: { ...summary(), landing: [-1, ...Array(LANDING_BINS - 1).fill(0)] } })
    ],
    ['a note that is not a number', entry({ summary: { ...summary(), noteSec: { C4: 2 } } })],
    ['NaN seconds on a note', entry({ summary: { ...summary(), noteSec: { 60: NaN } } })],
    ['a missing tone band', entry({ summary: { ...summary(), tone: { body: 1 } } })],
    ['a fractional lowest note', entry({ summary: { ...summary(), lowestNote: 60.5 } })],
    [
      'no recorded length (saved before it was measured)',
      entry({ summary: { ...summary(), recordedSec: undefined } })
    ],
    ['no summary', entry({ summary: null })],
    ['an older way of listening', entry({ version: VOICE_ANALYSIS_VERSION - 1 })],
    ['no version (saved before versions)', entry({ version: undefined })]
  ])('drops an entry with %s', (_name, bad) => {
    expect(parseVoiceCache([bad, entry()])).toEqual([entry()])
  })

  it('treats anything but a list as empty', () => {
    expect(parseVoiceCache({ folder: 'Fly Away' })).toEqual([])
  })
})
