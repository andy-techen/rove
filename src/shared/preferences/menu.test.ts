import { describe, expect, it } from 'vitest'
import { parseDockChoice } from './menu'

describe('parseDockChoice', () => {
  it.each([
    [{ action: 'newSong' }, { action: 'newSong' }],
    [{ folder: 'Sunset' }, { folder: 'Sunset' }],
    [{ action: 'formatDisk' }, null],
    [{ folder: 42 }, null],
    [null, null],
    ['newSong', null]
  ])('reads %j as %j', (raw, choice) => {
    expect(parseDockChoice(raw)).toEqual(choice)
  })
})
