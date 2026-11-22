import { describe, expect, it } from 'vitest'
import { Project, createProject, withNewTrack, withRecordedClip } from '../song/project'
import {
  ClipRef,
  anyGrouped,
  clipsInBox,
  copyClips,
  deleteClips,
  groupClips,
  moveClips,
  pasteClips,
  pickClip,
  ungroupClips,
  withGroupmates
} from './clipSets'

// Vocal 1 has clips a (2–4 s) and b (6–8 s); Vocal 2 has c (3–5 s).
function song() {
  const start = createProject('Song', 48000)
  const v1 = start.tracks[0].id
  const two = withNewTrack(start, 'vocal')
  const v2 = two.track.id
  let p = withRecordedClip(two.project, v1, { file: 'a.wav', start: 2, offset: 0, duration: 2 })
  p = withRecordedClip(p, v1, { file: 'b.wav', start: 6, offset: 0, duration: 2 })
  p = withRecordedClip(p, v2, { file: 'c.wav', start: 3, offset: 0, duration: 2 })
  const ref = (trackId: string, file: string): ClipRef => ({
    trackId,
    clipId: p.tracks.find((t) => t.id === trackId)!.clips.find((c) => c.file === file)!.id
  })
  return { p, v1, v2, a: ref(v1, 'a.wav'), b: ref(v1, 'b.wav'), c: ref(v2, 'c.wav') }
}

const startsOf = (p: Project, trackId: string) =>
  p.tracks.find((t) => t.id === trackId)!.clips.map((c) => [c.file, c.start])

describe('clip groups', () => {
  it('picks a whole group when one of its clips is picked', () => {
    const { p, a, b, c } = song()
    const grouped = groupClips(p, [a, c])
    expect(withGroupmates(grouped, [a])).toEqual([c, a])
    expect(withGroupmates(grouped, [b])).toEqual([b])
  })

  it('unlinks a group without changing its clips', () => {
    const { p, v1, a, c } = song()
    const ungrouped = ungroupClips(groupClips(p, [a, c]), [a])
    expect(anyGrouped(ungrouped, [a, c])).toBe(false)
    expect(startsOf(ungrouped, v1)).toEqual(startsOf(p, v1))
  })

  it('needs two or more clips to make a group', () => {
    const { p, a } = song()
    expect(anyGrouped(groupClips(p, [a]), [a])).toBe(false)
  })
})

describe('moveClips', () => {
  it('moves the clips together, across tracks', () => {
    const { p, v1, v2, a, c } = song()
    const moved = moveClips(p, [a, c], 1)
    expect(startsOf(moved, v1)).toEqual([
      ['a.wav', 3],
      ['b.wav', 6]
    ])
    expect(startsOf(moved, v2)).toEqual([['c.wav', 4]])
  })

  it('stops when the earliest clip reaches the start', () => {
    const { p, v1, a, b } = song()
    expect(startsOf(moveClips(p, [a, b], -5), v1)).toEqual([
      ['a.wav', 0],
      ['b.wav', 4]
    ])
  })

  it('never punches out a clip that is moving with it', () => {
    const { p, v1, a, b } = song()
    // a slides onto where b was; b moves on ahead of it.
    expect(startsOf(moveClips(p, [a, b], 4), v1)).toEqual([
      ['a.wav', 6],
      ['b.wav', 10]
    ])
  })
})

describe('selecting and editing several clips', () => {
  it('finds the clips a box touches, in the lanes it covers', () => {
    const { p, v1, a, b, c } = song()
    expect(clipsInBox(p.tracks, [v1], 3.5, 6.5)).toEqual([a, b])
    expect(clipsInBox(p.tracks, [v1, c.trackId], 4.5, 3)).toEqual([a, c])
  })

  it('adds a clip to the selection with ⌘-click and takes it out again', () => {
    const { p, a, b } = song()
    const both = pickClip(p, [a], b, 'toggle')
    expect(both).toEqual([a, b])
    expect(pickClip(p, both, b, 'toggle')).toEqual([a])
    expect(pickClip(p, both, b, 'only')).toEqual([b])
  })

  it('deletes all of them', () => {
    const { p, v1, v2, a, c } = song()
    const left = deleteClips(p, [a, c])
    expect(startsOf(left, v1)).toEqual([['b.wav', 6]])
    expect(startsOf(left, v2)).toEqual([])
  })

  it('pastes copies with their spacing, onto a picked track when copied from one', () => {
    const { p, v2, a, b } = song()
    const copied = copyClips(p, [a, b])!
    const { project } = pasteClips(p, copied, 10, v2)
    expect(startsOf(project, v2)).toEqual([
      ['c.wav', 3],
      ['a.wav', 10],
      ['b.wav', 14]
    ])
  })

  it('pastes clips copied from several tracks back onto their own tracks', () => {
    const { p, v1, v2, a, c } = song()
    const { project } = pasteClips(p, copyClips(p, [a, c])!, 10, v2)
    expect(startsOf(project, v1)).toContainEqual(['a.wav', 10])
    expect(startsOf(project, v2)).toContainEqual(['c.wav', 11])
  })

  it('gives a pasted group its own link, apart from the original', () => {
    const { p, a, c } = song()
    const grouped = groupClips(p, [a, c])
    const { project, pasted } = pasteClips(grouped, copyClips(grouped, [a, c])!, 10, null)
    expect(withGroupmates(project, [pasted[0]])).toHaveLength(2)
    expect(withGroupmates(project, [a])).toHaveLength(2)
  })
})
