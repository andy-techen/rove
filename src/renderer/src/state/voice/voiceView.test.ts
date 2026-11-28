import { describe, expect, it } from 'vitest'
import { VOICE_UNLOCK_SEC } from '@shared/songs/constants'
import { sungEntry } from './testEntries'
import { voiceView } from './voiceView'

const unlocked = (view: ReturnType<typeof voiceView>) => {
  if (view.locked) throw new Error('expected an unlocked view')
  return view
}

describe('voiceView', () => {
  it('stays locked until there are 3 minutes of singing, counted across songs', () => {
    const almost = voiceView([sungEntry('A', '2026-07-01', { sec: VOICE_UNLOCK_SEC - 1 })])
    expect(almost).toMatchObject({ locked: true, sungSec: VOICE_UNLOCK_SEC - 1 })
    const half = VOICE_UNLOCK_SEC / 2
    const view = voiceView([
      sungEntry('A', '2026-07-01', { sec: half }),
      sungEntry('B', '2026-07-02', { sec: half })
    ])
    expect(view.locked).toBe(false)
  })

  it('counts songs, recorded time and takes, a split take once', () => {
    const take = sungEntry('A', '2026-07-01', { sec: 10, recordedSec: 30 })
    const split = { ...take, ref: { ...take.ref, offsetSec: 20 } }
    const other = sungEntry('B', '2026-07-02', { sec: 10, recordedSec: 15 })
    expect(voiceView([take, split, other]).totals).toEqual({
      songs: 2,
      recordedSec: 75,
      takes: 2
    })
  })

  it('lists songs by when they were last sung, newest first', () => {
    const view = unlocked(
      voiceView([
        sungEntry('Old', '2026-07-01', { sec: 100 }),
        sungEntry('New', '2026-09-01', { sec: 100 }),
        sungEntry('Old', '2026-10-01', { sec: 100 })
      ])
    )
    expect(view.songs.map((s) => s.folder)).toEqual(['Old', 'New'])
  })

  it('spans whole octaves around every note sung', () => {
    const view = unlocked(voiceView([sungEntry('A', '2026-07-01', { sec: 200, notes: [50, 67] })]))
    expect(view.keys).toEqual({ low: 48, high: 71 })
  })

  it('marks the months that reached a new high or low note', () => {
    const view = unlocked(
      voiceView([
        sungEntry('A', '2026-07-01', { sec: 100, notes: [50, 60] }),
        sungEntry('B', '2026-08-01', { sec: 100, notes: [50, 64] }),
        sungEntry('C', '2026-10-01', { sec: 100, notes: [47, 62] })
      ])
    )
    expect(view.months.map((m) => [m.month, m.newHigh, m.newLow, m.profile !== null])).toEqual([
      [6, false, false, true],
      [7, true, false, true],
      [8, false, false, false],
      [9, false, true, true]
    ])
  })
})
