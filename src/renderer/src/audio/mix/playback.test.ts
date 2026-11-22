import { describe, expect, it } from 'vitest'
import { fadeEnvelope, planClip } from './playback'

const clip = { start: 10, offset: 0, duration: 20 }

describe('planClip', () => {
  it('delays a clip that starts after the playhead', () => {
    expect(planClip(clip, 4)).toEqual({ delay: 6, offset: 0, duration: 20, into: 0 })
  })

  it('starts partway into a clip the playhead is inside', () => {
    expect(planClip(clip, 15)).toEqual({ delay: 0, offset: 5, duration: 15, into: 5 })
  })

  it('respects an existing file offset when starting partway in', () => {
    expect(planClip({ start: 10, offset: 2, duration: 20 }, 15)).toEqual({
      delay: 0,
      offset: 7,
      duration: 15,
      into: 5
    })
  })

  it('skips clips that already ended', () => {
    expect(planClip(clip, 30)).toBeNull()
    expect(planClip(clip, 45)).toBeNull()
  })

  it('skips empty clips', () => {
    expect(planClip({ start: 0, offset: 0, duration: 0 }, 0)).toBeNull()
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
