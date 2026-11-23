import { describe, expect, it } from 'vitest'
import { pickRecording } from './musicbrainz'
import { recording } from './testing'

describe('pickRecording', () => {
  it('picks the exact title and credit, ignoring case and quote style', () => {
    const match = recording({ title: 'Don’t Stop' })
    const result = pickRecording([match], "don't stop", 'fleetwood mac')
    expect(result).toEqual({ kind: 'match', recording: match })
  })

  it('leaves out live takes, videos and near-miss titles', () => {
    const result = pickRecording(
      [
        recording({ id: 'live', disambiguation: 'live' }),
        recording({ id: 'video', video: true }),
        recording({ id: 'edit', title: 'Dreams (radio edit)' })
      ],
      'Dreams',
      'Fleetwood Mac'
    )
    expect(result.kind).toBe('none')
  })

  it('treats versions within a few seconds as one, preferring the one with ISRCs', () => {
    const bare = recording({ id: 'a', isrcs: [], length: 257_000 })
    const coded = recording({ id: 'b', length: 258_500 })
    expect(pickRecording([bare, coded], 'Dreams', 'Fleetwood Mac')).toEqual({
      kind: 'match',
      recording: coded
    })
  })

  it('picks the take most versions agree on, over edits and extended mixes', () => {
    const takes = [257_000, 258_000, 256_500, 300_000, 200_000].map((length, i) =>
      recording({ id: `r${i}`, length, isrcs: i === 1 ? ['X', 'Y'] : ['X'] })
    )
    const result = pickRecording(takes, 'Dreams', 'Fleetwood Mac')
    expect(result).toMatchObject({ kind: 'match', recording: { id: 'r1' } })
  })

  it('asks for review when no length has a clear majority', () => {
    const album = recording({ id: 'album', length: 257_000 })
    const extended = recording({ id: 'long', length: 300_000 })
    const result = pickRecording([album, extended], 'Dreams', 'Fleetwood Mac')
    expect(result).toEqual({ kind: 'ambiguous', candidates: [album, extended] })
  })

  it('matches a joint credit only as written in full', () => {
    const duet = recording({
      title: 'Shallow',
      'artist-credit': [{ name: 'Lady Gaga', joinphrase: ' & ' }, { name: 'Bradley Cooper' }]
    })
    expect(pickRecording([duet], 'Shallow', 'Lady Gaga & Bradley Cooper').kind).toBe('match')
    expect(pickRecording([duet], 'Shallow', 'Lady Gaga').kind).toBe('none')
  })
})
