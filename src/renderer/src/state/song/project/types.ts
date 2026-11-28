import type { SongKey } from '../../../audio/pitch/key'
import type { Chord } from '../../../audio/music/chords'
import type { SongLyrics } from '../../lyrics/lyrics'
import type { PolishSettings } from '../../../audio/polish/polish'
import type { PolishSuggestion } from '../../../audio/polish/autoPolish'
import type { PROJECT_VERSION } from './constants'

export interface Clip {
  id: string
  file: string
  /** Where the clip sits on the timeline, in seconds. */
  start: number
  /** Where inside the file playback begins, in seconds (for trimming later). */
  offset: number
  /** How much of the file plays, in seconds. */
  duration: number
  /** Seconds to fade in from silence at the clip's start. */
  fadeIn?: number
  /** Seconds to fade out to silence at the clip's end. */
  fadeOut?: number
  /** Set when the vocals were removed: the song this clip played before (still on disk). */
  withVocals?: string
  /**
   * Vocal takes: semitones the music was moved while it was sung (unset is the song's own
   * key), so the voice profile can tell where the song sits for the singer.
   */
  semitones?: number
  /** Clips sharing a group id are picked, moved, copied and deleted together. */
  group?: string
}

/**
 * Vocals are sung; backing tracks play music files; a chords track plays the chords the
 * singer wrote. Both kinds of music are "Backing" to the singer.
 */
export type TrackRole = 'vocal' | 'backing' | 'chords'
export type VocalPart = 'lead' | 'harmony'

export interface Track {
  id: string
  role: TrackRole
  /** Vocal tracks only; decides the starting mix. */
  part?: VocalPart
  name: string
  /** Original file name, for backing tracks imported from the user's library. */
  sourceName?: string
  volume: number
  pan: number
  muted: boolean
  /** Vocal tracks only. */
  polish?: PolishSettings
  /** Vocal tracks only: what auto polish suggested, set when the singer asked for it. */
  polishSuggestion?: PolishSuggestion
  /** Chords tracks only: the chords it plays. */
  chart?: ChordChart
  /** Chords tracks only: what plays them; unset is guitar. */
  instrument?: Instrument
  /** Chords tracks only: the drums, once the track has played Beats. */
  beats?: BeatChart
  clips: Clip[]
}

export interface Project {
  version: typeof PROJECT_VERSION
  name: string
  /** Who's singing it. Optional; shown in the Songbook and used by later voice features. */
  artist?: string | null
  /** The singer's own reminder, set from the Songbook ("learn the bridge"). */
  note?: string | null
  sampleRate: number
  /** What tuning pulls notes toward; unset or null means the nearest of any note. */
  key?: SongKey | null
  lyrics?: SongLyrics | null
  /** How the backing music is played: unset means as it was recorded. */
  music?: Partial<MusicSettings>
  /** Set once the song has an instrumental; see `tempoOf`. */
  tempo?: SongTempo
  tracks: Track[]
}

/**
 * The song's beat, shared by every instrumental and the metronome so they stay in step:
 * at the original speed. Speed applies when it plays, as it does to music files.
 */
export interface SongTempo {
  bpm: number
  beatsPerBar: BeatsPerBar
  /** Where bar 1 starts on the timeline, in seconds at the original speed. */
  startSec: number
}

/**
 * An instrumental's chords, bar by bar, as written: in the original key, which Key moves
 * when it plays. It keeps time with the song's tempo.
 */
export interface ChordChart {
  /** Each bar's chords, sharing the bar evenly; an empty bar carries the last chord on. */
  bars: Chord[][]
  /** How each bar is played, alongside `bars`; a bar without one is strummed. */
  feels?: ChordFeel[]
}

export type BeatsPerBar = 3 | 4

/** Strummed across the strings, or fingerpicked a string at a time. */
export const GUITAR_FEELS = ['strum', 'pick'] as const
export type GuitarFeel = (typeof GUITAR_FEELS)[number]
/** One held chord a bar, or the chord's notes rolled up one a beat (shown as "Ballad"). */
export const PIANO_FEELS = ['chords', 'flowing'] as const
export type PianoFeel = (typeof PIANO_FEELS)[number]
/**
 * How a bar is played. The guitar's feels and the piano's share each bar's one slot, so
 * moving, copying or deleting bars carries both; each instrument reads the other's as
 * its nearest equivalent (`guitarFeel`, `pianoFeel`).
 */
export const CHORD_FEELS = [...GUITAR_FEELS, ...PIANO_FEELS] as const
export type ChordFeel = (typeof CHORD_FEELS)[number]

/** What an instrumental plays: a guitar or piano from its chords, or drums. */
export const INSTRUMENTS = ['guitar', 'piano', 'beats'] as const
export type Instrument = (typeof INSTRUMENTS)[number]

/** The drums' style for the whole song. Pop first; more grooves come later. */
export const GROOVE_IDS = ['pop'] as const
export type GrooveId = (typeof GROOVE_IDS)[number]

/** How busy the drums are in a bar, within the groove. */
export const BEAT_PARTS = ['main', 'quiet', 'big', 'fill', 'rest'] as const
export type BeatPart = (typeof BEAT_PARTS)[number]

/** The drums on the beat pad, in the order the home row plays them. */
export const PAD_DRUMS = ['kick', 'snare', 'clap', 'rim', 'hat', 'openHat', 'tom', 'crash'] as const
export type PadDrum = (typeof PAD_DRUMS)[number]

/** A drum struck in a beat of your own, `at` beats into the bar (0 is the first beat). */
export interface PadHit {
  drum: PadDrum
  at: number
}

/**
 * A beat the singer made on the pad: every hit in its bar. Numbered as they're made, so
 * "My beat 2" keeps its name.
 */
export interface MyBeat {
  n: number
  /** What the singer called it; unset is "My beat {n}". */
  name?: string
  hits: PadHit[]
}

/** What a bar of drums plays: one of the groove's parts, or a beat of your own. */
export type BarBeat = BeatPart | `mine-${number}`

/** A beats track's drums: one groove, what each bar plays, and the beats made for it. */
export interface BeatChart {
  groove: GrooveId
  parts: BarBeat[]
  mine?: MyBeat[]
}

/** Drum bars copied from a track: what each plays, and the beats of your own they use. */
export interface CopiedBeats {
  parts: BarBeat[]
  mine: MyBeat[]
}

export interface MusicSettings {
  /** 1 is the original speed; 1.1 is 10% faster. */
  speed: number
  /** Whole semitones up (or down, negative) from the original key. */
  semitones: number
  /** Tone of the music, in dB: low shelf (bass) and high shelf (brightness). */
  bassDb: number
  brightnessDb: number
  /** The metronome: heard while playing and recording (with a count-in), never exported. */
  clickOn: boolean
  /** Its volume, 0 to 1. */
  click: number
}
