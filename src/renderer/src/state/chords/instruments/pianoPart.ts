import { PITCH_CLASSES } from '@shared/units'
import { CHORD_TONES, Chord } from '../../../audio/music/chords'
import { ChordFeel, PianoFeel, pianoFeel } from '../../song/project'
import { StrumTimeline } from './strum'
import {
  BASS_LOWEST,
  CHORDS_BASS_LEVEL,
  CHORDS_LEVEL,
  CHORD_LOWEST,
  FLOWING_BASS_LEVEL,
  FLOWING_LEVEL,
  GOLDEN,
  PIANO_CHANGE_ACCENT,
  PREVIEW_BEATS,
  SAME_TIME,
  VARIATION
} from './constants'

/** One piano key struck: when, which note, how hard, and how long it's held down. */
export interface PianoEvent {
  time: number
  midi: number
  /** 0 to 1. */
  velocity: number
  /** Seconds until the key (or the pedal) is let go; the note then dies away. */
  holdSec: number
}

/** A chord as a pianist plays it: a bass note, and the chord in the right hand. */
export interface PianoVoicing {
  bass: number
  /** Close together, low to high. */
  chord: number[]
}

const above = (lowest: number, pitchClass: number): number =>
  lowest + ((((pitchClass - lowest) % PITCH_CLASSES) + PITCH_CLASSES) % PITCH_CLASSES)

export function pianoVoicing(chord: Chord): PianoVoicing {
  const bass = above(BASS_LOWEST, chord.bass ?? chord.root)
  const notes = CHORD_TONES[chord.quality]
    .map((tone) => above(CHORD_LOWEST, chord.root + tone))
    .sort((a, b) => a - b)
  return { bass, chord: notes }
}

/** Which hand a note is in: the bass is let go when it plays again, the rest by the pedal. */
type Hand = 'bass' | 'chord'

interface Strike {
  time: number
  midi: number
  strength: number
  hand: Hand
}

/** Every key struck in one bar, before holds and accents. */
function barStrikes(
  timeline: StrumTimeline,
  barStart: number,
  feel: PianoFeel,
  voicingAt: (sec: number) => PianoVoicing | null,
  changesIn: number[]
): Strike[] {
  // Each new chord starts the pattern again from its bass, wherever in the bar it lands.
  const starts = [barStart, ...changesIn]
  const barEnd = barStart + timeline.beatsPerBar * timeline.secPerBeat
  return starts.flatMap((start, s) => {
    const voicing = voicingAt(start)
    if (!voicing) return []
    const bass: Strike = {
      time: start,
      midi: voicing.bass,
      strength: feel === 'chords' ? CHORDS_BASS_LEVEL : FLOWING_BASS_LEVEL,
      hand: 'bass'
    }
    if (feel === 'chords')
      return [
        bass,
        ...voicing.chord.map((midi) => ({
          time: start,
          midi,
          strength: CHORDS_LEVEL,
          hand: 'chord' as const
        }))
      ]
    const until = starts[s + 1] ?? barEnd
    const rolled: Strike[] = []
    for (let i = 1; start + i * timeline.secPerBeat < until - SAME_TIME; i++)
      rolled.push({
        time: start + i * timeline.secPerBeat,
        midi: voicing.chord[(i - 1) % voicing.chord.length],
        strength: FLOWING_LEVEL,
        hand: 'chord'
      })
    return [bass, ...rolled]
  })
}

/**
 * Every key the piano strikes over a chart, in timeline seconds, each bar played its own
 * way (`feels`, read as the piano's; unset bars are "Chords"). A bass note is held until
 * the next one; everything rings until the pedal lifts, at the next bar or chord.
 */
export function pianoEvents(timeline: StrumTimeline, feels: ChordFeel[] = []): PianoEvent[] {
  const barSec = timeline.secPerBeat * timeline.beatsPerBar
  const bars = Math.round((timeline.endSec - timeline.startSec) / barSec)
  const voicingAt = (sec: number): PianoVoicing | null => {
    const chord = timeline.chords.find((c) => sec >= c.start - SAME_TIME && sec < c.end)?.chord
    return chord ? pianoVoicing(chord) : null
  }
  const changes = timeline.chords.map((c) => c.start)

  const strikes: Strike[] = []
  for (let bar = 0; bar < bars; bar++) {
    const barStart = timeline.startSec + bar * barSec
    const barEnd = barStart + barSec
    const changesIn = changes.filter((c) => c > barStart + SAME_TIME && c < barEnd - SAME_TIME)
    strikes.push(
      ...barStrikes(timeline, barStart, pianoFeel(feels[bar] ?? 'strum'), voicingAt, changesIn)
    )
  }

  // Where the pedal lifts after `time`: the next bar, the next chord or the chart's end.
  const liftAfter = (time: number): number => {
    const nextBar =
      timeline.startSec + (Math.floor((time - timeline.startSec) / barSec + SAME_TIME) + 1) * barSec
    const nextChange = changes.find((c) => c > time + SAME_TIME) ?? Infinity
    return Math.min(nextBar, nextChange, timeline.endSec)
  }
  const isChange = (time: number): boolean => changes.some((c) => Math.abs(c - time) < SAME_TIME)
  return strikes.map((s, i) => {
    const nextBass =
      s.hand === 'bass'
        ? (strikes.slice(i + 1).find((n) => n.hand === 'bass')?.time ?? Infinity)
        : Infinity
    const wobble = 1 - VARIATION * ((i * GOLDEN) % 1)
    return {
      time: s.time,
      midi: s.midi,
      velocity: Math.min(1, s.strength * (isChange(s.time) ? PIANO_CHANGE_ACCENT : 1) * wobble),
      holdSec: Math.min(nextBass, liftAfter(s.time)) - s.time
    }
  })
}

/** One chord struck and held for `holdSec`, the way the piano plays it in a song. */
export function pianoChord(chord: Chord, holdSec: number): PianoEvent[] {
  return pianoEvents({
    chords: [{ chord, start: 0, end: holdSec }],
    secPerBeat: holdSec / PREVIEW_BEATS,
    beatsPerBar: PREVIEW_BEATS,
    startSec: 0,
    endSec: holdSec
  })
}
