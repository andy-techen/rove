import { describe, expect, it } from 'vitest'
import {
  CHART_BPM_RANGE,
  Project,
  chordsTracksOf,
  createProject,
  parseProject,
  withChartBars,
  withChartBeats,
  withChartTempo,
  withChordBacking,
  withMusicPitch,
  withMusicSpeed,
  withNewTrack
} from '../song/project'
import { hasMusicChoice, mixdownOf, selectLanes, songEnd } from '../song/selectors'
import { chartClickGrid, chartTimeline, placeAt } from './chart'
import { chartFromText } from './chordText'
import { chordName } from './noteNames'

const C = { root: 0, quality: 'major' } as const

/** A song whose chart is `text`, at 60 bpm so a beat is a second. */
function song(text: string, beatsPerBar: 3 | 4 = 4): Project {
  const { project, track } = withChordBacking(createProject('Song', 48000), C)
  const withBars = withChartBars(project, track.id, chartFromText(text).bars)
  return withChartTempo(withChartBeats(withBars, track.id, beatsPerBar), track.id, 60)
}
const chartOf = (p: Project, n = 0) => chordsTracksOf(p)[n].chart
const lineOf = (p: Project) => chartTimeline(p, chartOf(p))!
const heard = (p: Project) =>
  lineOf(p).chords.map((s) => [s.start, s.end, s.chord && chordName(s.chord)])

describe('withChordBacking', () => {
  it('adds a track with a chart to fill in, named as backing', () => {
    const { project, track } = withChordBacking(createProject('Song', 48000), C)
    expect(track.chart?.bars.map((bar) => bar.length)).toEqual([1, 0, 0, 0])
    expect(track.name).toBe('Backing 1')
    expect(project.tracks).toContainEqual(track)
  })

  it('adds another instrumental in time with the first, numbered after the music', () => {
    const withFile = withNewTrack(song('C G'), 'backing').project
    const { track } = withChordBacking(withFile, C)
    expect(track.name).toBe('Backing 3')
    expect(track.chart?.bpm).toBe(60)
  })

  it('keeps the tempo within a sensible range', () => {
    const p = song('C')
    expect(chartOf(withChartTempo(p, chordsTracksOf(p)[0].id, 1000))?.bpm).toBe(CHART_BPM_RANGE.max)
  })

  it('drops a chart it can’t read when opening a song', () => {
    const p = song('C')
    const broken = { ...chordsTracksOf(p)[0], chart: { bpm: 'fast', bars: 'C G' } }
    expect(chartOf(parseProject({ ...p, tracks: [broken] }))).toBeUndefined()
  })

  it('moves a song-wide chart from an older song onto its chords track', () => {
    const p = song('C G')
    const old = { ...p, chart: chartOf(p), tracks: [{ ...chordsTracksOf(p)[0], chart: undefined }] }
    expect(chartOf(parseProject(old))).toEqual(chartOf(p))
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
    const grid = chartClickGrid(lineOf(song('C G', 3)))
    expect(grid.clicks.map((c) => c.accent)).toEqual([true, false, false, true, false, false])
    expect(grid.beatsPerBar).toBe(3)
  })
})

describe('placeAt', () => {
  it('finds the bar, and the half of a split bar, playing at a time', () => {
    const p = song('| C | G A |')
    const bars = chartOf(p)!.bars
    expect(placeAt(lineOf(p), bars, 1)).toEqual({ bar: 0, slot: 0 })
    expect(placeAt(lineOf(p), bars, 6)).toEqual({ bar: 1, slot: 1 })
    expect(placeAt(lineOf(p), bars, 8)).toBeNull()
  })
})

describe('a song with only chords', () => {
  it('can be sung over and runs as long as its chart', () => {
    const p = song('C G Am F')
    expect(hasMusicChoice(p, false)).toBe(true)
    expect(songEnd(p)).toBe(16)
  })

  it('shows the chords on their own lane, with the music and before vocals', () => {
    const lanes = selectLanes(song('C G'), {})
    expect(lanes.map((l) => l.role)).toEqual(['chords', 'vocal'])
    expect(lanes[0].chords?.map((c) => [c.name, c.place.bar])).toEqual([
      ['C', 0],
      ['G', 1]
    ])
  })

  it('runs as long as its longest instrumental', () => {
    const p = song('C G')
    const { project, track } = withChordBacking(p, C)
    expect(songEnd(withChartBars(project, track.id, chartFromText('C G Am F D').bars))).toBe(20)
  })

  it('exports the chords as they sound, ringing on past the last bar', () => {
    const p = song('C G')
    const track = chordsTracksOf(p)[0]
    const buffer = { duration: 10 } as AudioBuffer
    const { tracks, lengthSec } = mixdownOf(p, {}, {}, [{ trackId: track.id, buffer, start: 0 }])
    const chords = tracks[p.tracks.indexOf(track)]
    expect(chords.clips).toEqual([{ buffer, start: 0, offset: 0, duration: 10 }])
    expect(chords.role).toBe('backing')
    expect(lengthSec).toBe(10)
  })
})
