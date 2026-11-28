import { describe, expect, it } from 'vitest'
import { parseSettings } from './settings'

describe('parseSettings', () => {
  it('keeps absolute folders and drops anything else', () => {
    expect(parseSettings({ songsFolder: '/Users/sam/Songs', exportsFolder: 'Exports' })).toEqual({
      songsFolder: '/Users/sam/Songs',
      exportsFolder: null
    })
    expect(parseSettings('nonsense')).toEqual({ songsFolder: null, exportsFolder: null })
  })
})
