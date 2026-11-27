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
  canLineUp: false,
  canSyncHarmony: false,
  vocalPart: null,
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

  it("offers to fix a take's timing where it can be fixed", () => {
    const items = enabled(contextMenu('clip', state({ canLineUp: true, canSyncHarmony: true })))
    expect(items).toEqual(expect.arrayContaining(['lineUp', 'syncHarmony']))
    expect(enabled(contextMenu('clip', state({ canLineUp: true, canEdit: false })))).not.toContain(
      'lineUp'
    )
  })

  it('offers to make a lead a harmony, and a harmony a lead', () => {
    const rows = (part: 'lead' | 'harmony') =>
      enabled(contextMenu('track', state({ vocalPart: part })))
    expect(rows('lead')).toContain('makeHarmony')
    expect(rows('lead')).not.toContain('makeLead')
    expect(rows('harmony')).toContain('makeLead')
  })

  it('shows no part to switch to on a music track', () => {
    const actions = contextMenu('track', state()).flatMap((i) =>
      i === 'separator' ? [] : [i.action]
    )
    expect(actions).not.toContain('makeHarmony')
    expect(actions).not.toContain('makeLead')
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
