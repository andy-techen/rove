import { t } from '@shared/copy'
import {
  BarBeat,
  BeatChart,
  BeatPart,
  BeatsPerBar,
  GrooveId,
  MyBeat,
  PadDrum,
  PadHit,
  Project
} from '../song/project'
import { ChartPlace, ChartTimeline, barGrid } from './chart'

/** The sounds a drum part is made of: every drum on the pad. */
export type DrumVoice = PadDrum

/** One drum struck: when on the timeline, and how hard (0 to 1). */
export interface DrumHit {
  time: number
  voice: DrumVoice
  velocity: number
}

/** A hit within a bar: `at` beats after its start. */
interface Step {
  at: number
  voice: DrumVoice
  level: number
}

const steps = (voice: DrumVoice, level: number, ...at: number[]): Step[] =>
  at.map((a) => ({ at: a, voice, level }))

const EIGHTHS_PER_BEAT = 2

// Hats on every eighth, a little louder on the beat so the bar has a pulse.
const eighthHats = (beats: number, level: number): Step[] =>
  Array.from({ length: beats * EIGHTHS_PER_BEAT }, (_, k) => ({
    at: k / EIGHTHS_PER_BEAT,
    voice: 'hat' as const,
    level: k % EIGHTHS_PER_BEAT === 0 ? level : level * OFFBEAT_HAT
  }))
const OFFBEAT_HAT = 0.7

type Pattern = Record<'main' | 'quiet' | 'big', Step[]>

/**
 * Each groove's bar, by how busy it is, in 4/4 and 3/4. Fill and Rest are worked out
 * from these (see `stepsFor`), so every groove has them.
 */
const GROOVES: Record<GrooveId, Record<BeatsPerBar, Pattern>> = {
  pop: {
    4: {
      main: [...steps('kick', 1, 0, 2), ...steps('snare', 0.9, 1, 3), ...eighthHats(4, 0.8)],
      quiet: [...steps('kick', 0.6, 0), ...steps('rim', 0.6, 3), ...steps('hat', 0.5, 0, 1, 2, 3)],
      big: [
        ...steps('kick', 1, 0, 1, 2, 3),
        ...steps('snare', 1, 1, 3),
        ...eighthHats(4, 0.9),
        ...steps('openHat', 0.7, 3.5)
      ]
    },
    // A waltz: the kick on one, the snare answering on two and three.
    3: {
      main: [...steps('kick', 1, 0), ...steps('snare', 0.7, 1, 2), ...eighthHats(3, 0.8)],
      quiet: [...steps('kick', 0.6, 0), ...steps('rim', 0.5, 1, 2), ...steps('hat', 0.5, 0, 1, 2)],
      big: [
        ...steps('kick', 1, 0, 2.5),
        ...steps('snare', 0.9, 1, 2),
        ...eighthHats(3, 0.9),
        ...steps('openHat', 0.7, 2.5)
      ]
    }
  }
}

// A fill keeps the groove for the first half of the bar, then runs down the snare in
// sixteenths, building up into whatever comes next.
const FILL_STEP = 0.25
const FILL_FROM_LEVEL = 0.5

function fillSteps(main: Step[], beatsPerBar: number): Step[] {
  const half = beatsPerBar / 2
  const count = Math.round(half / FILL_STEP)
  const run = Array.from({ length: count }, (_, k) => ({
    at: half + k * FILL_STEP,
    voice: 'snare' as const,
    level: FILL_FROM_LEVEL + ((1 - FILL_FROM_LEVEL) * k) / Math.max(1, count - 1)
  }))
  return [...main.filter((s) => s.at < half), ...run]
}

function grooveSteps(groove: GrooveId, beatsPerBar: BeatsPerBar, part: BeatPart): Step[] {
  const pattern = GROOVES[groove][beatsPerBar]
  if (part === 'rest') return []
  if (part === 'fill') return fillSteps(pattern.main, beatsPerBar)
  return pattern[part]
}

// How hard each drum on the pad strikes. Keys are on or off, so these set the balance a
// drummer would: cymbals lighter than the drums.
const PAD_LEVEL: Record<PadDrum, number> = {
  kick: 1,
  snare: 0.9,
  clap: 0.9,
  rim: 0.7,
  hat: 0.8,
  openHat: 0.8,
  tom: 0.9,
  crash: 0.9
}

function myBeatSteps(beat: MyBeat, beatsPerBar: BeatsPerBar): Step[] {
  return (
    beat.hits
      // A beat made in fours, played in threes, loses its last beat.
      .filter((hit) => hit.at < beatsPerBar)
      .map((hit) => ({ at: hit.at, voice: hit.drum, level: PAD_LEVEL[hit.drum] }))
  )
}

const myBeat = (beats: BeatChart, part: BarBeat): MyBeat | undefined =>
  beats.mine?.find((b) => `mine-${b.n}` === part)

function stepsFor(beats: BeatChart, beatsPerBar: BeatsPerBar, part: BarBeat): Step[] {
  const mine = myBeat(beats, part)
  if (mine) return myBeatSteps(mine, beatsPerBar)
  return (BEAT_PART_SET as Set<string>).has(part)
    ? grooveSteps(beats.groove, beatsPerBar, part as BeatPart)
    : []
}
const BEAT_PART_SET = new Set<BeatPart>(['main', 'quiet', 'big', 'fill', 'rest'])

/**
 * The hits that play what `part` plays, as a start for a beat of your own: a new beat
 * begins as the bar sounds now, never from an empty pad.
 */
export function hitsFrom(beats: BeatChart, beatsPerBar: BeatsPerBar, part: BarBeat): PadHit[] {
  return stepsFor(beats, beatsPerBar, part).map((step) => ({ drum: step.voice, at: step.at }))
}

// Taps snap to sixteenths: tight enough for any pop groove, loose enough to forgive.
export const SNAP_BEATS = 0.25
// Two taps of one drum closer than this are one hit: a loop pass replaying a tap, or a
// key pressed twice by accident.
const SAME_HIT_BEATS = 0.0625

/**
 * Where a tap `at` beats into a bar lands: on the nearest sixteenth when snapping, and
 * back to the start of the bar if it rounds up to the next one.
 */
export function placeTap(at: number, beatsPerBar: BeatsPerBar, snap: boolean): number {
  const placed = snap ? Math.round(at / SNAP_BEATS) * SNAP_BEATS : at
  const wrapped = ((placed % beatsPerBar) + beatsPerBar) % beatsPerBar
  return tidyBeat(wrapped)
}

// Hit places are kept to a thousandth of a beat, so saved songs stay readable.
const BEAT_PRECISION = 1000

/** A place in the bar, kept to a thousandth of a beat. */
export const tidyBeat = (at: number): number => Math.round(at * BEAT_PRECISION) / BEAT_PRECISION

/** `hits` with one more, unless that drum already plays there. */
export function withHit(hits: PadHit[], hit: PadHit): PadHit[] {
  const there = hits.some((h) => h.drum === hit.drum && Math.abs(h.at - hit.at) < SAME_HIT_BEATS)
  return there ? hits : [...hits, hit].sort((a, b) => a.at - b.at)
}

/** A beat of your own as one bar of hits, `time` in seconds from the bar's start. */
export const myBeatBar = (beat: MyBeat, beatsPerBar: BeatsPerBar, secPerBeat: number): DrumHit[] =>
  myBeatSteps(beat, beatsPerBar).map((s) => ({
    time: s.at * secPerBeat,
    voice: s.voice,
    velocity: s.level
  }))

/** What a bar's part is called: "Main", or "My beat 2". */
export const beatName = (beats: BeatChart, part: BarBeat): string => {
  const mine = myBeat(beats, part)
  if (mine) return mine.name ?? t('beats.mine', { n: mine.n })
  return t(`beats.${part as BeatPart}`)
}

// Drummers aren't machines: each hit lands a few milliseconds off and a little softer or
// harder. The wobble is worked out from the hit's place, so a part sounds the same every
// time it renders.
const LOOSEN_SEC = 0.004
const LOOSEN_VELOCITY = 0.08
// The well-known one-line hash from shader code: big, unrelated factors make the
// fractional part look random, yet the same input always gives the same output.
const HASH_FREQUENCY = 12.9898
const HASH_SCALE = 43758.5453
const wobble = (n: number): number => {
  const x = Math.sin(n * HASH_FREQUENCY) * HASH_SCALE
  // From 0..1 to -1..1.
  return (x - Math.floor(x)) * 2 - 1
}
// Each bar's hits get their own run of wobbles: more than a bar ever holds.
const HITS_PER_BAR_SEED = 64

/** Every drum hit the parts play, in time order, on the song's bars. */
export function beatHits(timeline: ChartTimeline, beats: BeatChart): DrumHit[] {
  const beatsPerBar = timeline.beatsPerBar as BeatsPerBar
  const barSec = timeline.secPerBeat * beatsPerBar
  const hits = beats.parts.flatMap((part, b) =>
    stepsFor(beats, beatsPerBar, part).map((step, i) => {
      const n = b * HITS_PER_BAR_SEED + i
      return {
        time: Math.max(
          timeline.startSec,
          timeline.startSec + b * barSec + step.at * timeline.secPerBeat + wobble(n) * LOOSEN_SEC
        ),
        voice: step.voice,
        velocity: Math.min(1, step.level * (1 + wobble(n + 0.5) * LOOSEN_VELOCITY))
      }
    })
  )
  return hits.sort((a, b) => a.time - b.time)
}

/** How many bars it takes to reach `endSec` on the timeline (at least one). */
export function barsUntil(project: Project, endSec: number): number {
  const grid = barGrid(project, 1)
  if (!grid) return 1
  const barSec = grid.secPerBeat * grid.beatsPerBar
  // Absorbs rounding, so a song ending exactly on a bar line doesn't get one more.
  return Math.max(1, Math.ceil((endSec - grid.startSec) / barSec - 1e-6))
}

/** One bar of drums as the timeline shows it. */
export interface BeatCell {
  start: number
  end: number
  part: BarBeat
  place: ChartPlace
}

/** Every bar of drums where it falls on the timeline, so each can be picked. */
export function beatCells(project: Project, beats: BeatChart): BeatCell[] {
  const grid = barGrid(project, beats.parts.length)
  if (!grid) return []
  const barSec = grid.secPerBeat * grid.beatsPerBar
  return beats.parts.map((part, b) => ({
    start: grid.startSec + b * barSec,
    end: grid.startSec + (b + 1) * barSec,
    part,
    place: { bar: b, slot: 0 }
  }))
}

/** One bar of `part` on its own, at the song's tempo: for hearing a beat while making it. */
export function barOf(project: Project, beats: BeatChart, part: BarBeat): DrumHit[] {
  const grid = barGrid(project, 1)
  return grid ? beatHits({ ...grid, startSec: 0 }, { ...beats, parts: [part] }) : []
}
