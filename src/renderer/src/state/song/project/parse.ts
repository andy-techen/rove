// Reading a saved `project.json`. A part Rove can't read is dropped rather than played wrong.
import type { Chord } from '../../../audio/music/chords'
import { t } from '@shared/copy'
import { mineOf } from './chords'
import { PROJECT_VERSION } from './constants'
import {
  BEAT_PARTS,
  CHORD_FEELS,
  GROOVE_IDS,
  INSTRUMENTS,
  PAD_DRUMS,
  type BeatChart,
  type BeatPart,
  type ChordChart,
  type ChordFeel,
  type GrooveId,
  type Instrument,
  type MyBeat,
  type PadDrum,
  type PadHit,
  type Project,
  type SongTempo
} from './types'

export function parseProject(data: unknown): Project {
  const p = data as { version?: unknown; name?: unknown; tracks?: unknown; artist?: unknown } | null
  if (
    !p ||
    p.version !== PROJECT_VERSION ||
    typeof p.name !== 'string' ||
    !Array.isArray(p.tracks)
  ) {
    throw new Error(t('song.notRoveProject'))
  }
  const project = p as Project
  // Only keep an artist field that's actually a non-empty string.
  if (typeof project.artist !== 'string' || !project.artist.trim()) delete project.artist
  return withReadableMusic(project)
}

function isChart(value: unknown): value is ChordChart {
  if (!value || typeof value !== 'object') return false
  const c = value as Partial<ChordChart>
  const isChord = (x: unknown): boolean => {
    const chord = x as Partial<Chord> | null
    return !!chord && typeof chord.root === 'number' && typeof chord.quality === 'string'
  }
  return (
    Array.isArray(c.bars) &&
    c.bars.every((bar) => Array.isArray(bar) && bar.every(isChord)) &&
    (c.feels === undefined ||
      (Array.isArray(c.feels) && c.feels.every((f) => CHORD_FEELS.includes(f as ChordFeel))))
  )
}

const isPadHit = (value: unknown): value is PadHit => {
  const hit = value as Partial<PadHit> | null
  return (
    !!hit &&
    PAD_DRUMS.includes(hit.drum as PadDrum) &&
    typeof hit.at === 'number' &&
    Number.isFinite(hit.at) &&
    hit.at >= 0
  )
}

/** A beat of your own as saved, or null when it can't be read. */
function readMyBeat(value: unknown): MyBeat | null {
  const beat = value as Partial<MyBeat> | null
  if (!beat || !Number.isInteger(beat.n)) return null
  if (beat.name !== undefined && typeof beat.name !== 'string') return null
  if (!Array.isArray(beat.hits) || !beat.hits.every(isPadHit)) return null
  const named = beat.name === undefined ? {} : { name: beat.name }
  return { n: beat.n!, ...named, hits: beat.hits }
}

/** Drums as saved, or null when they can't be read. */
function readBeatChart(value: unknown): BeatChart | null {
  const b = value as Partial<BeatChart> | null
  if (!b || !GROOVE_IDS.includes(b.groove as GrooveId) || !Array.isArray(b.parts)) return null
  if (b.mine !== undefined && !Array.isArray(b.mine)) return null
  const mine = (b.mine ?? []).map(readMyBeat)
  if (mine.some((m) => m === null)) return null
  const known = new Set((mine as MyBeat[]).map(mineOf))
  if (!b.parts.every((p) => BEAT_PARTS.includes(p as BeatPart) || known.has(p))) return null
  const chart: BeatChart = { groove: b.groove!, parts: b.parts }
  return b.mine === undefined ? chart : { ...chart, mine: mine as MyBeat[] }
}

function isTempo(value: unknown): value is SongTempo {
  const t = value as Partial<SongTempo> | null
  return (
    !!t &&
    typeof t.bpm === 'number' &&
    (t.beatsPerBar === 3 || t.beatsPerBar === 4) &&
    typeof t.startSec === 'number'
  )
}

/** The song's tempo and each chords track's chart, instrument and drums, as saved. */
function withReadableMusic(project: Project): Project {
  const updated: Project = { ...project }
  if (!isTempo(updated.tempo)) delete updated.tempo
  return {
    ...updated,
    tracks: project.tracks.map((track) => {
      if (track.role !== 'chords') return track
      const plain = { ...track }
      if (!isChart(plain.chart)) delete plain.chart
      if (!INSTRUMENTS.includes(plain.instrument as Instrument) || plain.instrument === 'guitar')
        delete plain.instrument
      const beats = readBeatChart(plain.beats)
      if (beats) plain.beats = beats
      else delete plain.beats
      // Drums without bars to play fall back to the guitar.
      if (plain.instrument === 'beats' && !plain.beats) delete plain.instrument
      return plain
    })
  }
}
