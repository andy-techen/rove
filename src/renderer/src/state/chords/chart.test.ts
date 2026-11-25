import { describe, expect, it } from 'vitest'
import {
  CHART_BPM_RANGE,
  Project,
  Track,
  chordsTracksOf,
  createProject,
  parseProject,
  tempoOf,
  withChartBars,
  withChartFeel,
  withBeatParts,
  withChordBacking,
  withInstrument,
  withMyBeat,
  withPastedBeats,
  copyBeats,
  withoutMyBeat,
  withMusicPitch,
  withMusicSpeed,
  withNewTrack,
  withSongBeats,
  withSongStart,
  withSongTempo
} from '../song/project'
import { hasMusicChoice, mixdownOf, selectLanes, songEnd } from '../song/selectors'
import { chartClickGrid, chartTimeline, draggedBarStart, nudgedBarStart, placeAt } from './chart'
import { chartFromText } from './chordText'
import { chordName } from './noteNames'
import { t } from '@shared/copy'

const C = { root: 0, quality: 'major' } as const

/** A song whose chart is `text`, at 60 bpm so a beat is a second. */
function song(text: string, beatsPerBar: 3 | 4 = 4): Project {
  const { project, track } = withChordBacking(createProject('Song', 48000), C)
  const withBars = withChartBars(project, track.id, chartFromText(text).bars)
  return withSongTempo(withSongBeats(withBars, beatsPerBar), 60)
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

  it('adds another instrumental on the song’s tempo, numbered after the music', () => {
    const withFile = withNewTrack(song('C G'), 'backing').project
    const { project, track } = withChordBacking(withFile, C, { bpm: 90, startSec: 0 })
    expect(track.name).toBe('Backing 3')
    expect(tempoOf(project).bpm).toBe(60)
  })

  it('starts the song’s tempo from the music, when Rove has heard it', () => {
    const { project } = withChordBacking(createProject('Song', 48000), C, {
      bpm: 92.437,
      startSec: 0.3
    })
    // Kept to a hundredth: rounding to 92 would drift a second behind in three minutes.
    expect(tempoOf(project)).toEqual({ bpm: 92.44, beatsPerBar: 4, startSec: 0.3 })
  })

  it('keeps the tempo within a sensible range', () => {
    expect(tempoOf(withSongTempo(song('C'), 1000)).bpm).toBe(CHART_BPM_RANGE.max)
  })

  it('drops a chart it can’t read when opening a song', () => {
    const p = song('C')
    const broken = { ...chordsTracksOf(p)[0], chart: { bpm: 'fast', bars: 'C G' } }
    expect(chartOf(parseProject({ ...p, tracks: [broken] }))).toBeUndefined()
  })

  it('numbers an older song’s “Chords” track with its music', () => {
    const p = withNewTrack(song('C'), 'backing').project
    const named = (t: Track) => (t.role === 'chords' ? { ...t, name: 'Chords' } : t)
    const opened = parseProject({ ...p, tracks: p.tracks.map(named) })
    expect(opened.tracks.filter((t) => t.role !== 'vocal').map((t) => t.name)).toEqual([
      'Backing 3',
      'Backing 2'
    ])
  })

  it('gives an older song the tempo its chart kept', () => {
    const p = song('C G')
    const track = chordsTracksOf(p)[0]
    const old = {
      ...p,
      tempo: undefined,
      tracks: [{ ...track, chart: { ...track.chart, bpm: 72, beatsPerBar: 3, startSec: 1 } }]
    }
    const opened = parseProject(old)
    expect(tempoOf(opened)).toEqual({ bpm: 72, beatsPerBar: 3, startSec: 1 })
    expect(chartOf(opened)).toEqual(track.chart)
  })

  it('keeps a piano part and its feels when the song is saved and opened', () => {
    const p = song('C G')
    const id = chordsTracksOf(p)[0].id
    const piano = withChartFeel(withInstrument(p, id, 'piano', 2), id, 1, 1, 'flowing')
    const opened = parseProject(JSON.parse(JSON.stringify(piano)))
    expect(chordsTracksOf(opened)[0].instrument).toBe('piano')
    expect(chartOf(opened)?.feels).toEqual(['strum', 'flowing'])
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
    expect(lanes[0].chords?.map((c) => c.name)).toEqual(['C', 'G'])
  })

  it('shows a kept chord as one block, with each bar inside it still there to pick', () => {
    const [lane] = selectLanes(song('| C | % | G A |'), {})
    expect(lane.chords?.map((c) => [c.name, c.start, c.end])).toEqual([
      ['C', 0, 8],
      ['G', 8, 10],
      ['A', 10, 12]
    ])
    expect(lane.chords?.[0].cells.map((c) => [c.place.bar, c.carried])).toEqual([
      [0, false],
      [1, true]
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

describe('a beats instrumental', () => {
  const drums = (bars = 6) => {
    const p = song('C G')
    return withInstrument(p, chordsTracksOf(p)[0].id, 'beats', bars)
  }

  it('starts on the main groove, long enough to run with the song', () => {
    expect(chordsTracksOf(drums())[0].beats).toEqual({
      groove: 'pop',
      parts: Array(6).fill('main')
    })
    expect(songEnd(drums())).toBe(24)
  })

  it('keeps the chords for switching back to guitar', () => {
    const p = drums()
    const back = withInstrument(p, chordsTracksOf(p)[0].id, 'guitar', 6)
    expect(chordsTracksOf(back)[0].instrument).toBeUndefined()
    expect(heard(back).map((c) => c[2])).toEqual(['C', 'G'])
  })

  it('shows a run of bars playing the same part as one block', () => {
    const p = drums(4)
    const id = chordsTracksOf(p)[0].id
    const [lane] = selectLanes(withBeatParts(p, id, ['main', 'main', 'fill', 'rest']), {})
    expect(lane.detail).toBe(t('timeline.detailBeats'))
    expect(lane.chords?.map((c) => [c.name, c.start, c.end])).toEqual([
      [t('beats.main'), 0, 8],
      [t('beats.fill'), 8, 12],
      [t('beats.rest'), 12, 16]
    ])
  })

  it('keeps your own beats when the song opens again, named on the lane', () => {
    const p = drums(1)
    const id = chordsTracksOf(p)[0].id
    const hits = [{ drum: 'kick' as const, at: 0 }]
    const made = withBeatParts(withMyBeat(p, id, { n: 2, hits }), id, ['mine-2'])
    const opened = parseProject(JSON.parse(JSON.stringify(made)))
    expect(chordsTracksOf(opened)[0].beats).toEqual(chordsTracksOf(made)[0].beats)
    expect(selectLanes(opened, {})[0].chords?.[0].name).toBe(t('beats.mine', { n: 2 }))
  })

  it('reads a beat made on the older eighth-note pad as hits on those eighths', () => {
    const p = drums(1)
    const track = chordsTracksOf(p)[0]
    const old = { n: 1, pads: { kick: [0, 3], snare: [4], hat: [], rim: [] } }
    const beats = { groove: 'pop', parts: ['mine-1'], mine: [old] }
    const opened = parseProject({ ...p, tracks: [{ ...track, beats }] })
    expect(chordsTracksOf(opened)[0].beats?.mine).toEqual([
      {
        n: 1,
        hits: [
          { drum: 'kick', at: 0 },
          { drum: 'kick', at: 1.5 },
          { drum: 'snare', at: 2 }
        ]
      }
    ])
  })

  it('moves bars that played a deleted beat to the one made before it', () => {
    const p = drums(2)
    const id = chordsTracksOf(p)[0].id
    const hits = [{ drum: 'kick' as const, at: 0 }]
    const two = withMyBeat(withMyBeat(p, id, { n: 1, hits }), id, { n: 2, hits })
    const made = withBeatParts(two, id, ['mine-2', 'fill'])
    expect(chordsTracksOf(withoutMyBeat(made, id, 2))[0].beats?.parts).toEqual(['mine-1', 'fill'])
  })

  it('sends bars back to the main groove when no beat of your own is left', () => {
    const p = drums(2)
    const id = chordsTracksOf(p)[0].id
    const hits = [{ drum: 'kick' as const, at: 0 }]
    const made = withBeatParts(withMyBeat(p, id, { n: 1, hits }), id, ['mine-1', 'fill'])
    const beats = chordsTracksOf(withoutMyBeat(made, id, 1))[0].beats
    expect(beats).toEqual({ groove: 'pop', parts: ['main', 'fill'], mine: [] })
  })

  it('pastes copied drum bars in after the picked ones', () => {
    const p = drums(3)
    const id = chordsTracksOf(p)[0].id
    const set = withBeatParts(p, id, ['main', 'fill', 'rest'])
    const copied = copyBeats(chordsTracksOf(set)[0].beats!, 1, 1)
    const pasted = withPastedBeats(set, id, 1, copied)
    expect(chordsTracksOf(pasted)[0].beats?.parts).toEqual(['main', 'fill', 'fill', 'rest'])
  })

  it('brings a beat of your own along when pasting into another track', () => {
    const p = drums(1)
    const from = chordsTracksOf(p)[0].id
    const hits = [{ drum: 'clap' as const, at: 1 }]
    const made = withBeatParts(withMyBeat(p, from, { n: 1, hits }), from, ['mine-1'])
    const copied = copyBeats(chordsTracksOf(made)[0].beats!, 0, 0)
    const added = withChordBacking(made, C)
    const to = added.track.id
    const other = withMyBeat(withInstrument(added.project, to, 'beats', 1), to, {
      n: 1,
      hits: []
    })
    const beats = chordsTracksOf(withPastedBeats(other, to, 1, copied))[1].beats!
    // Its own "My beat 1" is a different beat, so the pasted one comes in as "My beat 2".
    expect(beats.parts.slice(0, 2)).toEqual(['main', 'mine-2'])
    expect(beats.mine?.find((b) => b.n === 2)?.hits).toEqual(hits)
  })

  it('plays guitar again when the drums it was saved with can’t be read', () => {
    const p = drums()
    const broken = { ...chordsTracksOf(p)[0], beats: { groove: 'disco', parts: [] } }
    const opened = parseProject({ ...p, tracks: [broken] })
    expect(chordsTracksOf(opened)[0].instrument).toBeUndefined()
  })
})

describe('moving where the bars start', () => {
  const beat = { bpm: 120, startSec: 0.3 } // the music's beats: 0.3, 0.8, 1.3…

  it('moves every instrumental together, never before the song starts', () => {
    const p = withSongStart(song('C G'), 1.5)
    expect(lineOf(p).startSec).toBe(1.5)
    expect(tempoOf(withSongStart(p, -2)).startSec).toBe(0)
  })

  it('follows the drag where there is no beat close by', () => {
    expect(draggedBarStart(1, 0.12, 1, beat, 0.05)).toEqual({ startSec: 1.12, snappedAt: null })
  })

  it('snaps onto the music’s nearest beat when dragged close to it', () => {
    expect(draggedBarStart(1, 0.27, 1, beat, 0.05)).toEqual({ startSec: 1.3, snappedAt: 1.3 })
  })

  it('snaps onto the start of the song', () => {
    expect(draggedBarStart(0.5, -0.47, 1, null, 0.05)).toEqual({ startSec: 0, snappedAt: 0 })
    expect(draggedBarStart(0.5, -3, 1, null, 0.05).startSec).toBe(0)
  })

  it('works in the song’s own time when Speed plays it faster', () => {
    // At double speed, a second dragged on the timeline is two seconds of the song.
    const moved = draggedBarStart(1, 0.5, 2, null, 0.01)
    expect(moved.startSec).toBe(2)
  })

  it('nudges a little with the arrow keys', () => {
    expect(nudgedBarStart(1, 1, 1)).toBeCloseTo(1.02)
    expect(nudgedBarStart(0.01, -1, 1)).toBe(0)
  })
})
