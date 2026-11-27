import { describe, expect, it } from 'vitest'
import { selectTracks, tracksActedOn, deletionOf, adjacentTrack } from './trackSelection'

const order = ['b1', 'v1', 'v2', 'v3']

describe('selectTracks', () => {
  it('selects only the clicked track on a plain click', () => {
    expect(selectTracks(['v1', 'v2'], 'v3', 'only', order)).toEqual(['v3'])
  })

  it('adds or removes one track with ⌘-click', () => {
    expect(selectTracks(['v1'], 'v3', 'toggle', order)).toEqual(['v1', 'v3'])
    expect(selectTracks(['v1', 'v3'], 'v1', 'toggle', order)).toEqual(['v3'])
  })

  it('acts on the whole selection only from a selected track', () => {
    expect(tracksActedOn(['v1', 'v2'], 'v2')).toEqual(['v1', 'v2'])
    expect(tracksActedOn(['v1', 'v2'], 'v3')).toEqual(['v3'])
  })

  it('selects every track between with ⇧-click, ending on the one clicked', () => {
    expect(selectTracks(['v3'], 'b1', 'range', order)).toEqual(['v1', 'v2', 'v3', 'b1'])
    expect(selectTracks([], 'v2', 'range', order)).toEqual(['v2'])
  })
})

describe('deletionOf', () => {
  const clip = { trackId: 'v1', clipId: 'c1' }

  it('deletes the clip when a clip was clicked last', () => {
    expect(deletionOf('clip', clip, ['v1'])).toEqual({ kind: 'clip', clip })
  })

  it('deletes every selected track when track names were clicked last', () => {
    expect(deletionOf('tracks', null, ['v1', 'v2'])).toEqual({
      kind: 'tracks',
      trackIds: ['v1', 'v2']
    })
  })

  it('deletes picked bars, never the instrumental they belong to', () => {
    const bars = { trackId: 'k1', first: 1, last: 2 }
    expect(deletionOf('bars', null, ['k1'], bars)).toEqual({ kind: 'bars', bars })
    expect(deletionOf('bars', null, ['k1'])).toBeNull()
  })

  it('deletes nothing more once the clicked clip is gone, not its whole track', () => {
    expect(deletionOf(null, null, ['v1'])).toBeNull()
    expect(deletionOf('clip', null, ['v1'])).toBeNull()
  })
})

describe('adjacentTrack', () => {
  const order = ['music', 'lead', 'harmony']

  it('moves up and down the lanes from the selected track', () => {
    expect(adjacentTrack(order, 'lead', 1)).toBe('harmony')
    expect(adjacentTrack(order, 'lead', -1)).toBe('music')
  })

  it('stays put at either end', () => {
    expect(adjacentTrack(order, 'harmony', 1)).toBe('harmony')
    expect(adjacentTrack(order, 'music', -1)).toBe('music')
  })

  it('starts from the top or bottom when nothing is selected', () => {
    expect(adjacentTrack(order, null, 1)).toBe('music')
    expect(adjacentTrack(order, null, -1)).toBe('harmony')
  })
})
