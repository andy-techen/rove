import { describe, expect, it } from 'vitest'
import { MenuState, contextMenu } from './contextMenu'

const state = (overrides: Partial<MenuState> = {}): MenuState => ({
  canEdit: true,
  selectedClips: 1,
  anyGrouped: false,
  oneGroup: false,
  canPaste: false,
  canSplit: false,
  canMoveUp: false,
  canMoveDown: true,
  ...overrides
})
const enabled = (items: ReturnType<typeof contextMenu>) =>
  items.flatMap((i) => (i !== 'separator' && i.enabled ? [i.action] : []))

describe('contextMenu', () => {
  it('offers what can be done to a clip right now', () => {
    expect(enabled(contextMenu('clip', state()))).toEqual(['cut', 'copy', 'deleteClip'])
  })

  it('offers grouping for several clips and ungrouping for a group', () => {
    expect(enabled(contextMenu('clip', state({ selectedClips: 2 })))).toContain('groupClips')
    const group = enabled(
      contextMenu('clip', state({ selectedClips: 2, anyGrouped: true, oneGroup: true }))
    )
    expect(group).toContain('ungroupClips')
    expect(group).not.toContain('groupClips')
  })

  it('dims song edits while they are not allowed, but still lets clips be copied', () => {
    expect(enabled(contextMenu('clip', state({ canEdit: false })))).toEqual(['copy'])
  })

  it('offers renaming, moving and removing a track', () => {
    expect(enabled(contextMenu('track', state()))).toEqual([
      'renameTrack',
      'moveTrackDown',
      'removeTrack'
    ])
  })
})
