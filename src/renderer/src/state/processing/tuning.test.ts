import { describe, expect, it } from 'vitest'
import { Project, createProject, polishOf, withTrackPolish } from '../song/project'
import { tuningOf } from './tuning'

const song = (): Project => createProject('Song', 48000)
const lead = (p: Project): Project['tracks'][number] => p.tracks[0]

const withTuning = (p: Project, tuning: number, enabled = true): Project =>
  withTrackPolish(p, lead(p).id, { ...polishOf(lead(p)), tuning, enabled })

describe('tuningOf', () => {
  it('leaves new vocals as sung', () => {
    const p = song()
    expect(tuningOf(lead(p), null, 'premium')).toBeNull()
  })

  it('tunes to any note until the song has a key', () => {
    const p = withTuning(song(), 0.5)
    expect(tuningOf(lead(p), null, 'premium')?.scale).toHaveLength(12)
    expect(tuningOf(lead(p), { tonic: 9, mode: 'minor' }, 'premium')?.scale).toEqual([
      0, 2, 4, 5, 7, 9, 11
    ])
  })

  it('is snappier and stronger as the slider rises', () => {
    const natural = withTuning(song(), 0.2)
    const snappy = withTuning(song(), 1)
    const a = tuningOf(lead(natural), null, 'premium')!
    const b = tuningOf(lead(snappy), null, 'premium')!
    expect(b.strength).toBeGreaterThan(a.strength)
    expect(b.retuneSec).toBeLessThan(a.retuneSec)
  })

  it('switches off with the polish switch, to compare with the voice as sung', () => {
    const p = withTuning(song(), 0.8, false)
    expect(tuningOf(lead(p), null, 'premium')).toBeNull()
  })

  it('plays as sung on the free plan, since tuning is premium', () => {
    const p = withTuning(song(), 0.8)
    expect(tuningOf(lead(p), null, 'free')).toBeNull()
  })
})
