import { describe, expect, it } from 'vitest'
import { fadeEnvelope, planClip } from './playback'

const clip = { start: 10, offset: 0, duration: 20 }

describe('planClip', () => {
  it.each([
    ['delays a clip that starts after the playhead', clip, 4, [6, 0, 20, 0]],
    ['starts partway into a clip the playhead is inside', clip, 15, [0, 5, 15, 5]],
    ['keeps a file offset when starting partway in', { ...clip, offset: 2 }, 15, [0, 7, 15, 5]]
  ])('%s', (_, played, at, [delay, offset, duration, into]) => {
    expect(planClip(played, at)).toEqual({ delay, offset, duration, into })
  })

  it.each([
    ['a clip that just ended', clip, 30],
    ['a clip that ended a while ago', clip, 45],
    ['an empty clip', { start: 0, offset: 0, duration: 0 }, 0]
  ])('skips %s', (_, played, at) => {
    expect(planClip(played, at)).toBeNull()
  })
})

describe('fadeEnvelope', () => {
  it('is flat at full volume with no fades', () => {
    expect(fadeEnvelope(10)).toEqual([
      [0, 1],
      [10, 1]
    ])
  })

  it('ramps in from silence and out to silence', () => {
    expect(fadeEnvelope(10, 2, 3)).toEqual([
      [0, 0],
      [2, 1],
      [7, 1],
      [10, 0]
    ])
  })

  it('starts partway through a fade-in at the right level', () => {
    expect(fadeEnvelope(10, 2, 0, 1)).toEqual([
      [0, 0.5],
      [1, 1],
      [9, 1]
    ])
  })

  it('starts inside the fade-out when playback begins late in the clip', () => {
    expect(fadeEnvelope(10, 0, 4, 8)).toEqual([
      [0, 0.5],
      [2, 0]
    ])
  })

  it('shortens overlapping fades so they meet in the middle', () => {
    expect(fadeEnvelope(4, 4, 4)).toEqual([
      [0, 0],
      [2, 1],
      [4, 0]
    ])
  })
})
