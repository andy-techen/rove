import { describe, expect, it } from 'vitest'
import { GestureStart } from './clipGestures'
import { Clip, Project, createProject, withNewTrack } from '../song/project'
import { snapGesture } from './snapping'

const clip = (id: string, start: number, duration: number): Clip => ({
  id,
  file: `${id}.wav`,
  start,
  offset: 0,
  duration
})

/** Two vocal tracks: the dragged clip at 2–4 s on one, another clip at 10–13 s on the other. */
function song(): { project: Project; drag: GestureStart } {
  const base = createProject('Song', 48000)
  const other = withNewTrack(base, 'vocal')
  const [first, second] = other.project.tracks
  const dragged = clip('a', 2, 2)
  const project = {
    ...other.project,
    tracks: [
      { ...first, clips: [dragged] },
      { ...second, clips: [clip('b', 10, 3)] }
    ]
  }
  return { project, drag: { base: project, trackId: first.id, clip: dragged, fileSec: 30 } }
}

// 8 px at 100 px/s: snaps within 0.08 s. Small ticks every 0.5 s.
const view = { toleranceSec: 0.08, gridSec: 0.5, playheadSec: 7.3, free: false }

describe('snapGesture', () => {
  it('lands a moved clip’s start on another track’s clip end', () => {
    const { drag } = song()
    // Start would be 12.96; the other clip ends at 13.
    expect(snapGesture(drag, 'move', 10.96, view)).toEqual({ deltaSec: 11, at: 13 })
  })

  it('lands a moved clip’s end on another clip’s start', () => {
    const { drag } = song()
    // End would be 10.05; the other clip starts at 10.
    expect(snapGesture(drag, 'move', 6.05, view)).toEqual({ deltaSec: 6, at: 10 })
  })

  it('lands on the playhead', () => {
    const { drag } = song()
    expect(snapGesture(drag, 'move', 5.25, view)).toEqual({ deltaSec: 5.3, at: 7.3 })
  })

  it('falls back to the nearest tick on the ruler', () => {
    const { drag } = song()
    // Start would be 5.04 and end 7.04: no clip edge near, but ticks at 5 and 7 are.
    const snapped = snapGesture(drag, 'move', 3.04, view)
    expect(snapped.deltaSec).toBeCloseTo(3)
    expect([5, 7]).toContain(snapped.at)
  })

  it('prefers the playhead or a clip edge to a tick that is a little nearer', () => {
    const { drag } = song()
    // Start would be 7.27: the 7.25 tick is 0.02 away, the playhead (7.3) 0.03.
    const snapped = snapGesture(drag, 'move', 5.27, { ...view, gridSec: 0.25 })
    expect(snapped).toEqual({ deltaSec: 5.3, at: 7.3 })
  })

  it('moves freely when nothing is close, or when snapping is off', () => {
    const { drag } = song()
    expect(snapGesture(drag, 'move', 3.2, view)).toEqual({ deltaSec: 3.2, at: null })
    expect(snapGesture(drag, 'move', 10.96, { ...view, free: true })).toEqual({
      deltaSec: 10.96,
      at: null
    })
  })

  it('snaps the edge being trimmed, and never a fade', () => {
    const { drag } = song()
    // Trimming the end from 4 to 7.27 lands on the playhead at 7.3.
    expect(snapGesture(drag, 'trimEnd', 3.27, view)).toEqual({ deltaSec: 3.3, at: 7.3 })
    expect(snapGesture(drag, 'fadeIn', 0.49, view)).toEqual({ deltaSec: 0.49, at: null })
  })
})
