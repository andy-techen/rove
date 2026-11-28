import { describe, expect, it } from 'vitest'
import {
  deleteClip,
  insertClip,
  lineUpClip,
  moveClip,
  setClipFades,
  splitClip,
  syncPhrases,
  trimClipEnd,
  trimClipStart,
  withRecordedClip,
  withTrackAudio
} from './clips'
import { MIN_CLIP_SEC } from './constants'
import { createProject, withNewTrack } from './tracks'
import type { Clip, Project } from './types'

const clip = (id: string, start: number, duration: number, offset = 0): Clip => ({
  id,
  file: `${id}.wav`,
  start,
  offset,
  duration
})
const spans = (clips: Clip[]): [string, number, number, number][] =>
  clips.map((c) => [c.file, c.start, c.offset, c.duration])

describe('insertClip (punch-in)', () => {
  const existing = clip('old', 10, 20) // covers 10–30

  it('keeps clips that do not overlap', () => {
    expect(spans(insertClip([existing], clip('new', 40, 5)))).toEqual([
      ['old.wav', 10, 0, 20],
      ['new.wav', 40, 0, 5]
    ])
  })

  it('trims the end of a clip the new take starts inside', () => {
    expect(spans(insertClip([existing], clip('new', 25, 10)))).toEqual([
      ['old.wav', 10, 0, 15],
      ['new.wav', 25, 0, 10]
    ])
  })

  it('trims the start of a clip the new take ends inside, keeping its audio aligned', () => {
    expect(spans(insertClip([existing], clip('new', 5, 10)))).toEqual([
      ['new.wav', 5, 0, 10],
      ['old.wav', 15, 5, 15]
    ])
  })

  it('splits a clip around a take recorded in its middle', () => {
    const result = insertClip([existing], clip('new', 15, 5))
    expect(spans(result)).toEqual([
      ['old.wav', 10, 0, 5],
      ['new.wav', 15, 0, 5],
      ['old.wav', 20, 10, 10]
    ])
    expect(new Set(result.map((c) => c.id)).size).toBe(3)
  })

  it('drops clips the new take covers completely', () => {
    expect(spans(insertClip([existing], clip('new', 0, 40)))).toEqual([['new.wav', 0, 0, 40]])
  })

  it('respects an existing offset when trimming the start', () => {
    expect(spans(insertClip([clip('old', 10, 20, 3)], clip('new', 5, 10)))).toEqual([
      ['new.wav', 5, 0, 10],
      ['old.wav', 15, 8, 15]
    ])
  })
})

describe('withRecordedClip', () => {
  it('punches the take into only the chosen track', () => {
    let p = withNewTrack(createProject('Song', 48000), 'vocal').project
    const [one, two] = p.tracks
    p = withRecordedClip(p, one.id, { file: 'a.wav', start: 0, offset: 0, duration: 30 })
    p = withRecordedClip(p, two.id, { file: 'b.wav', start: 0, offset: 0, duration: 30 })
    p = withRecordedClip(p, one.id, { file: 'c.wav', start: 10, offset: 0, duration: 5 })
    expect(spans(p.tracks[0].clips)).toEqual([
      ['a.wav', 0, 0, 10],
      ['c.wav', 10, 0, 5],
      ['a.wav', 15, 15, 15]
    ])
    expect(spans(p.tracks[1].clips)).toEqual([['b.wav', 0, 0, 30]])
  })
})

describe('lineUpClip', () => {
  const recorded = (start: number) => {
    const p = withNewTrack(createProject('Song', 48000), 'vocal').project
    const id = p.tracks[1].id
    return {
      id,
      p: withRecordedClip(p, id, { id: 'take', file: 't.wav', start, offset: 0, duration: 30 })
    }
  }

  it('slides a late take earlier by the lag', () => {
    const { p, id } = recorded(10)
    expect(spans(lineUpClip(p, id, 'take', 0.14).tracks[1].clips)).toEqual([['t.wav', 9.86, 0, 30]])
  })

  it('trims what would land before the song starts, keeping the rest in time', () => {
    const { p, id } = recorded(0.1)
    const [c] = lineUpClip(p, id, 'take', 0.25).tracks[1].clips
    expect(c.start).toBe(0)
    expect(c.offset).toBeCloseTo(0.15)
    expect(c.duration).toBeCloseTo(29.85)
  })
})

describe('syncPhrases', () => {
  const harmony = (start: number) => {
    const p = withNewTrack(createProject('Song', 48000), 'vocal', { part: 'harmony' }).project
    const id = p.tracks[1].id
    return {
      id,
      p: withRecordedClip(p, id, { id: 'take', file: 'h.wav', start, offset: 0, duration: 10 })
    }
  }
  const phrase = (from: number, to: number, bySec: number) => ({ from, to, bySec })

  it('cuts the take halfway through each pause and moves each phrase to meet the lead', () => {
    const { p, id } = harmony(10)
    const phrases = [phrase(1, 3, 0.1), phrase(5, 7, -0.05), phrase(8, 9, 0)]
    const clips = syncPhrases(p, id, 'take', phrases).tracks[1].clips
    const rounded = spans(clips).map((s) =>
      s.map((v) => (typeof v === 'number' ? +v.toFixed(3) : v))
    )
    expect(rounded).toEqual([
      ['h.wav', 9.9, 0, 4],
      ['h.wav', 14.05, 4, 3.5],
      ['h.wav', 17.55, 7.55, 2.45]
    ])
  })

  it('keeps the phrases together as one group', () => {
    const { p, id } = harmony(10)
    const clips = syncPhrases(p, id, 'take', [phrase(1, 3, 0.1), phrase(5, 7, 0)]).tracks[1].clips
    expect(clips[0].group).toBeDefined()
    expect(clips[1].group).toBe(clips[0].group)
  })

  it('gives up the quiet before a phrase rather than overlap the one before it', () => {
    const { p, id } = harmony(10)
    const phrases = [phrase(1, 3, -0.2), phrase(3.3, 5, 0.2)]
    const [first, second] = syncPhrases(p, id, 'take', phrases).tracks[1].clips
    expect(second.start).toBeCloseTo(first.start + first.duration)
    expect(second.offset).toBeCloseTo(3.55)
  })

  it('trims what would land before the song starts, keeping the rest in time', () => {
    const { p, id } = harmony(0.05)
    const [c] = syncPhrases(p, id, 'take', [phrase(0, 2, 0.1), phrase(4, 6, 0)]).tracks[1].clips
    expect([c.start, c.offset]).toEqual([0, expect.closeTo(0.05)])
  })
})

describe('withTrackAudio', () => {
  it('puts a single clip at the start of the track', () => {
    const p = createProject('Song', 48000)
    const id = p.tracks[0].id
    const next = withTrackAudio(p, id, 'audio/take-001.wav', 12.5)
    expect(next.tracks[0].clips).toEqual([
      { id: expect.any(String), file: 'audio/take-001.wav', start: 0, offset: 0, duration: 12.5 }
    ])
  })

  it('replaces the previous take on that track only, leaving the original untouched', () => {
    let p = withNewTrack(createProject('Song', 48000), 'vocal').project
    const [one, two] = p.tracks
    p = withTrackAudio(p, one.id, 'audio/take-001.wav', 5)
    p = withTrackAudio(p, two.id, 'audio/take-002.wav', 6)
    const again = withTrackAudio(p, one.id, 'audio/take-003.wav', 7)
    expect(again.tracks.map((t) => t.clips.map((c) => c.file))).toEqual([
      ['audio/take-003.wav'],
      ['audio/take-002.wav']
    ])
    expect(p.tracks[0].clips[0].file).toBe('audio/take-001.wav')
  })
})

describe('clip editing', () => {
  const setup = (clips: Clip[]): { id: string; p: Project } => {
    const p = createProject('Song', 48000)
    const id = p.tracks[0].id
    return { id, p: { ...p, tracks: [{ ...p.tracks[0], clips }] } }
  }
  const trackSpans = (p: Project): ReturnType<typeof spans> => spans(p.tracks[0].clips)

  it('moves a clip and punches out what it lands on', () => {
    const { p, id } = setup([clip('a', 0, 10), clip('b', 20, 10)])
    expect(trackSpans(moveClip(p, id, 'b', 5))).toEqual([
      ['a.wav', 0, 0, 5],
      ['b.wav', 5, 0, 10]
    ])
  })

  it('never moves a clip before the start of the song', () => {
    const { p, id } = setup([clip('a', 5, 10)])
    expect(trackSpans(moveClip(p, id, 'a', -3))).toEqual([['a.wav', 0, 0, 10]])
  })

  it('trims the start while the audio stays in place', () => {
    const { p, id } = setup([clip('a', 10, 20)])
    expect(trackSpans(trimClipStart(p, id, 'a', 14))).toEqual([['a.wav', 14, 4, 16]])
  })

  it('can un-trim the start, but not past the beginning of the file', () => {
    const { p, id } = setup([clip('a', 14, 16, 4)])
    expect(trackSpans(trimClipStart(p, id, 'a', 0))).toEqual([['a.wav', 10, 0, 20]])
  })

  it('trims the end, but not past the end of the file', () => {
    const { p, id } = setup([clip('a', 10, 20)])
    expect(trackSpans(trimClipEnd(p, id, 'a', 25, 20))).toEqual([['a.wav', 10, 0, 15]])
    expect(trackSpans(trimClipEnd(p, id, 'a', 99, 20))).toEqual([['a.wav', 10, 0, 20]])
  })

  it('keeps a sliver rather than trimming a clip away', () => {
    const { p, id } = setup([clip('a', 10, 20)])
    const [, , , duration] = trackSpans(trimClipEnd(p, id, 'a', 0, 20))[0]
    expect(duration).toBeCloseTo(MIN_CLIP_SEC)
  })

  it('splits at the playhead, keeping fades on the outer ends', () => {
    const { p, id } = setup([{ ...clip('a', 10, 20), fadeIn: 1, fadeOut: 2 }])
    const [left, right] = splitClip(p, id, 'a', 15).tracks[0].clips
    expect([left.start, left.offset, left.duration, left.fadeIn, left.fadeOut]).toEqual([
      10, 0, 5, 1, 0
    ])
    expect([right.start, right.offset, right.duration, right.fadeIn, right.fadeOut]).toEqual([
      15, 5, 15, 0, 2
    ])
    expect(left.id).not.toBe(right.id)
  })

  it('ignores a split outside the clip', () => {
    const { p, id } = setup([clip('a', 10, 20)])
    expect(trackSpans(splitClip(p, id, 'a', 40))).toEqual([['a.wav', 10, 0, 20]])
  })

  it('clamps fades to the clip length', () => {
    const { p, id } = setup([clip('a', 0, 4)])
    const c = setClipFades(p, id, 'a', { fadeIn: 10, fadeOut: -1 }).tracks[0].clips[0]
    expect([c.fadeIn, c.fadeOut]).toEqual([4, 0])
  })

  it('deletes a clip', () => {
    const { p, id } = setup([clip('a', 0, 4), clip('b', 5, 4)])
    expect(trackSpans(deleteClip(p, id, 'a'))).toEqual([['b.wav', 5, 0, 4]])
  })
})
