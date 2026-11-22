import { describe, expect, it } from 'vitest'
import { parseSettings } from './settings'

describe('parseSettings', () => {
  it('keeps an absolute songs folder and drops anything else', () => {
    expect(parseSettings({ songsFolder: '/Users/sam/Songs' })).toEqual({
      songsFolder: '/Users/sam/Songs'
    })
    expect(parseSettings({ songsFolder: 'Songs' })).toEqual({ songsFolder: null })
    expect(parseSettings('nonsense')).toEqual({ songsFolder: null })
  })
})
