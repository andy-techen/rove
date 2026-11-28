import { describe, expect, it } from 'vitest'
import { withTrackAudio } from './clips'
import { parseProject } from './parse'
import { createProject } from './tracks'

describe('parseProject', () => {
  it('round-trips a saved project', () => {
    const p = withTrackAudio(createProject('Song', 48000), 'x', 'a.wav', 1)
    expect(parseProject(JSON.parse(JSON.stringify(p)))).toEqual(p)
  })

  it.each([null, {}, { version: 3, name: 'x', tracks: [] }, { version: 2, name: 'x' }])(
    'rejects %j',
    (data) => {
      expect(() => parseProject(data)).toThrow(/isn't a Rove project/)
    }
  )
})
