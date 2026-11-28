import { describe, expect, it } from 'vitest'
import type { Chord } from '../../audio/music/chords'
import type { Track } from '../song/project'
import { barsTarget, canPaste, copyChartBars, pasteAfter, pastedSpan } from './songClipboard'

const C: Chord = { root: 0, quality: 'major' }
const G: Chord = { root: 7, quality: 'major' }

const instrumental = (over: Partial<Track>): Track => ({
  id: 'c1',
  role: 'chords',
  name: 'Guitar',
  volume: 1,
  pan: 0,
  muted: false,
  clips: [],
  ...over
})
const chords = instrumental({ chart: { bars: [[C], [G], [C]], feels: ['pick'] } })
const drums = instrumental({ instrument: 'beats', beats: { groove: 'pop', parts: ['main'] } })
const twoBars = { bar: 2, slot: 0, last: 1 }

describe('barsTarget', () => {
  it('targets the picked bars of a chart, in order, with their feels', () => {
    expect(barsTarget(chords, twoBars, false)).toMatchObject({
      kind: 'chart',
      trackId: 'c1',
      range: [1, 2],
      feels: ['pick', 'strum', 'strum']
    })
  })

  it('targets drum bars on a beats track, even if it once had a chart', () => {
    const target = barsTarget({ ...drums, chart: { bars: [[C]] } }, twoBars, false)
    expect(target?.kind).toBe('beats')
  })

  it('leaves copy and paste to clips while clips are picked', () => {
    expect(barsTarget(chords, twoBars, true)).toBeNull()
  })

  it('has nothing to target on a vocal or an instrumental without bars', () => {
    expect(barsTarget(instrumental({ role: 'vocal' }), twoBars, false)).toBeNull()
    expect(barsTarget(instrumental({ instrument: 'beats' }), twoBars, false)).toBeNull()
  })
})

describe('copyChartBars', () => {
  it('copies the picked bars and how each is played', () => {
    const target = barsTarget(chords, { bar: 0, slot: 1, last: 1 }, false)
    if (target?.kind !== 'chart') throw new Error('expected a chart')
    expect(copyChartBars(target)).toEqual({ bars: [[C], [G]], feels: ['pick', 'strum'] })
  })
})

describe('pasteAfter', () => {
  it('puts pasted bars in after the picked ones and picks what was pasted', () => {
    expect(pasteAfter([1, 2], 3)).toEqual({ at: 3, place: { bar: 3, slot: 0, last: 5 } })
  })
})

describe('canPaste', () => {
  const none = { clips: null, bars: null, beats: null }
  const copiedBars = { ...none, bars: { bars: [[C]], feels: [] } }

  it('pastes copied chords only into a chart, and drum bars only into beats', () => {
    const chart = barsTarget(chords, twoBars, false)
    const beats = barsTarget(drums, twoBars, false)
    expect(canPaste(copiedBars, chart)).toBe(true)
    expect(canPaste(copiedBars, beats)).toBe(false)
    expect(canPaste({ ...none, beats: { parts: ['main'], mine: [] } }, beats)).toBe(true)
  })

  it('always offers to paste copied clips', () => {
    const clips = { items: [] }
    expect(canPaste({ ...none, clips }, null)).toBe(true)
    expect(canPaste(none, null)).toBe(false)
  })
})

describe('pastedSpan', () => {
  it('reaches to the end of the clip that finishes last', () => {
    const clip = (duration: number) => ({ id: 'x', file: 'a.wav', start: 0, offset: 0, duration })
    const items = [
      { trackId: 'v1', at: 0, clip: clip(4) },
      { trackId: 'v1', at: 3, clip: clip(2) }
    ]
    expect(pastedSpan({ items })).toBe(5)
  })
})
