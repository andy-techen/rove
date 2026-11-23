import { describe, expect, it } from 'vitest'
import {
  CHART_BPM_RANGE,
  Project,
  chordsTrackOf,
  createProject,
  parseProject,
  withChartBars,
  withChartTempo,
  withChordBacking,
  withMusicPitch,
  withMusicSpeed,
  withoutTracks
} from '../song/project'
import { hasMusicChoice, mixdownOf, selectLanes, songEnd } from '../song/selectors'
import { chartClickGrid, chartTimeline } from './chart'
import { chartFromText } from './chordText'
import { chordName } from './noteNames'

const C = { root: 0, quality: 'major' } as const

/** A song whose chart is `text`, at 60 bpm so a beat is a second. */
function song(text: string, beatsPerBar: 3 | 4 = 4): Project {
  const p = withChordBacking(createProject('Song', 48000), C)
  const withBars = withChartBars(p, chartFromText(text).bars)
  return withChartTempo({ ...withBars, chart: { ...withBars.chart!, beatsPerBar } }, 60)
}
const heard = (p: Project) =>
  chartTimeline(p)!.chords.map((s) => [s.start, s.end, s.chord && chordName(s.chord)])

describe('withChordBacking', () => {
  it('starts a chart and one track to play it', () => {
    const p = withChordBacking(createProject('Song', 48000), C)
    expect(p.chart?.bars.map((bar) => bar.length)).toEqual([1, 0, 0, 0])
    expect(chordsTrackOf(p)?.name).toBe('Chords')
    expect(withChordBacking(p, C).tracks).toHaveLength(p.tracks.length)
  })

  it('brings back the track for a chart whose track was removed', () => {
    const p = song('C G')
    const removed = withoutTracks(p, [chordsTrackOf(p)!.id])
    expect(withChordBacking(removed, C).chart).toEqual(p.chart)
    expect(chordsTrackOf(withChordBacking(removed, C))).toBeDefined()
  })

  it('keeps the tempo within a sensible range', () => {
    expect(withChartTempo(song('C'), 1000).chart?.bpm).toBe(CHART_BPM_RANGE.max)
  })

  it('drops a chart it can’t read when opening a song', () => {
    const p = parseProject({ ...song('C'), chart: { bpm: 'fast', bars: 'C G' } })
    expect(p.chart).toBeUndefined()
  })
})

describe('chartTimeline', () => {
  it('lays bars out at the tempo, with empty bars carrying the chord on', () => {
    expect(heard(song('| C | % | G A |'))).toEqual([
      [0, 8, 'C'],
      [8, 10, 'G'],
      [10, 12, 'A']
    ])
  })

  it('plays faster with Speed and higher with Key', () => {
    const p = withMusicPitch(withMusicSpeed(song('C G'), 1.25), 2)
    expect(heard(p)).toEqual([
      [0, 3.2, 'D'],
      [3.2, 6.4, 'A']
    ])
  })

  it('is silent until the first chord', () => {
    expect(heard(song('| % | C |'))[0]).toEqual([0, 4, null])
  })

  it('clicks every beat, higher on the first of each bar', () => {
    const grid = chartClickGrid(chartTimeline(song('C G', 3))!)
    expect(grid.clicks.map((c) => c.accent)).toEqual([true, false, false, true, false, false])
    expect(grid.beatsPerBar).toBe(3)
  })
})

describe('a song with only chords', () => {
  it('can be sung over and runs as long as its chart', () => {
    const p = song('C G Am F')
    expect(hasMusicChoice(p, false)).toBe(true)
    expect(songEnd(p)).toBe(16)
  })

  it('shows the chords on their own lane, after the music and before vocals', () => {
    const lanes = selectLanes(song('C G'), {})
    expect(lanes.map((l) => l.role)).toEqual(['chords', 'vocal'])
    expect(lanes[0].chords?.map((c) => c.name)).toEqual(['C', 'G'])
  })

  it('exports the chords as they sound, ringing on past the last bar', () => {
    const p = song('C G')
    const track = chordsTrackOf(p)!
    const buffer = { duration: 10 } as AudioBuffer
    const { tracks, lengthSec } = mixdownOf(p, {}, {}, [{ trackId: track.id, buffer, start: 0 }])
    const chords = tracks[p.tracks.indexOf(track)]
    expect(chords.clips).toEqual([{ buffer, start: 0, offset: 0, duration: 10 }])
    expect(chords.role).toBe('backing')
    expect(lengthSec).toBe(10)
  })
})
