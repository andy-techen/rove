import { describe, expect, it } from 'vitest'
import { Clip, Project, createProject, withMusicSpeed, withNewTrack } from '../song/project'
import { clickGrid, clickTimes, countInSec, tempoOfMusic } from './metronome'

const clip = (start: number, offset: number, duration: number): Clip => ({
  id: 'm',
  file: 'music.wav',
  start,
  offset,
  duration
})

/** A song whose music starts 1 s in, trimmed so it plays from 0.5 s into its file. */
function withMusic(): Project {
  const added = withNewTrack(createProject('Song', 48000), 'backing', { sourceName: 'a.mp3' })
  return {
    ...added.project,
    tracks: added.project.tracks.map((t) =>
      t.role === 'backing' ? { ...t, clips: [clip(1, 0.5, 10)] } : t
    )
  }
}
// 120 BPM, first beat 0.25 s into the recording.
const beat = {
  bpm: 120,
  firstBeatSec: 0.25,
  times: Array.from({ length: 40 }, (_, k) => 0.25 + k * 0.5)
}

describe('clickGrid', () => {
  it('lines the clicks up with the music where it sits on the timeline', () => {
    const grid = clickGrid(withMusic(), 'music.wav', beat)!
    // The recording's beats fall at 0.25, 0.75, 1.25 s…; 0.5 s in plays at 1 s.
    expect(clickTimes(grid, 0, 2.6).map((c) => c.time)).toEqual([1.25, 1.75, 2.25])
  })

  it('follows the music when it is sped up', () => {
    const grid = clickGrid(withMusicSpeed(withMusic(), 1.25), 'music.wav', beat)!
    expect(grid.periodSec).toBeCloseTo(0.4)
  })

  it('only clicks while the music plays', () => {
    const grid = clickGrid(withMusic(), 'music.wav', beat)!
    const times = clickTimes(grid, 0, 60).map((c) => c.time)
    expect(Math.min(...times)).toBeGreaterThanOrEqual(1)
    expect(Math.max(...times)).toBeLessThanOrEqual(11)
  })

  it('has no clicks without a beat', () => {
    expect(clickGrid(withMusic(), 'music.wav', null)).toBeNull()
  })
})

describe('clickTimes', () => {
  it('accents the first beat of every bar of four', () => {
    const grid = clickGrid(withMusic(), 'music.wav', beat)!
    // The trim starts on the recording's second beat (counting from the first, 0.75 s
    // in); its fifth beat, the next bar, plays fourth.
    expect(clickTimes(grid, 0, 3.4).map((c) => c.accent)).toEqual([
      false,
      false,
      false,
      true,
      false
    ])
  })

  it('counts in for one bar', () => {
    expect(countInSec(clickGrid(withMusic(), 'music.wav', beat)!)).toBe(2)
  })

  it('clicks on the beats the music really plays, even when they drift', () => {
    const drifting = { ...beat, times: [0.25, 0.76, 1.29, 1.84, 2.41] }
    const grid = clickGrid(withMusic(), 'music.wav', drifting)!
    expect(clickTimes(grid, 0, 10).map((c) => c.time)).toEqual([1.26, 1.79, 2.34, 2.91])
  })
})

describe('tempoOfMusic', () => {
  // Bar lines for a tempo, as the chart lays them out at the song's speed.
  const beatsOf = (p: Project) => {
    const t = tempoOfMusic(p, 'music.wav', beat)!
    const speed = p.music?.speed ?? 1
    return [0, 1, 2].map((k) => +((t.startSec + (k * 60) / t.bpm) / speed).toFixed(6))
  }
  const clicksOf = (p: Project) =>
    clickGrid(p, 'music.wav', beat)!.clicks.map((c) => +c.time.toFixed(6))

  it('puts an instrumental’s beats on the music’s', () => {
    const p = withMusic()
    expect(clicksOf(p)).toEqual(expect.arrayContaining(beatsOf(p).filter((t) => t >= 1)))
    expect(tempoOfMusic(p, 'music.wav', beat)?.bpm).toBe(120)
  })

  it('stays on the music’s beats when the music plays faster', () => {
    const p = withMusicSpeed(withMusic(), 1.25)
    expect(clicksOf(p)).toEqual(expect.arrayContaining(beatsOf(p).filter((t) => t >= 1)))
  })
})
