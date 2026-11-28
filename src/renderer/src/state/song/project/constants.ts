import type { MusicSettings, SongTempo } from './types'

/** The `project.json` format this version of Rove reads and writes. */
export const PROJECT_VERSION = 2

// Names

/** Long enough for "Chorus harmony (high)", short enough to fit the lane header. */
export const TRACK_NAME_MAX_LENGTH = 40
/** Long enough for "Chorus, double time", short enough to sit on a bar. */
export const BEAT_NAME_MAX_LENGTH = 30

// Starting mix by role, so a beginner's first playback already sounds balanced: the lead
// sits centre, harmonies tuck in quieter and alternate left and right, and mastered
// backing tracks start lower so the vocal isn't buried.

export const MASTERED_MUSIC_VOLUME = 0.5
export const HARMONY_VOLUME = 0.7
export const HARMONY_PAN = 0.35

// Clips and lyrics

/** Shortest clip an edit may leave behind, so a clip never vanishes by accident. */
export const MIN_CLIP_SEC = 0.05
/** Furthest the lyrics can be nudged either way: more than a long intro. */
export const LYRICS_OFFSET_MAX_SEC = 60

// Music speed, key and tone

/** Beyond about a third faster or slower, stretched music starts to sound processed. */
export const MUSIC_SPEED_RANGE = { min: 0.7, max: 1.3 }
/** Half an octave either way covers moving a song into any singer's range. */
export const MUSIC_SEMITONES_MAX = 6
/** Beyond this either way, a shelf starts to sound like a different recording. */
export const MUSIC_TONE_MAX_DB = 6
/** How music the song hasn't changed plays: as recorded, with the metronome off. */
export const ORIGINAL_MUSIC: MusicSettings = {
  speed: 1,
  semitones: 0,
  bassDb: 0,
  brightnessDb: 0,
  clickOn: false,
  // Loud enough to hear over the music, not so loud it covers the voice.
  click: 0.7
}
/** Clip times are rescaled on every speed change; rounding keeps them from drifting. */
export const TIME_PRECISION = 1e6

// Chord charts and tempo

/** Slow ballads to fast punk: a tempo outside this is almost certainly a typo. */
export const CHART_BPM_RANGE = { min: 40, max: 240 }
/** A comfortable middle tempo to start a new chart from. */
export const DEFAULT_CHART_BPM = 100
/** Far more than any song needs; keeps a stray paste from making a huge chart. */
export const CHART_MAX_BARS = 500
/** A new chart starts with one line of bars, ready to fill in. */
export const NEW_CHART_BARS = 4
export const DEFAULT_TEMPO: SongTempo = { bpm: DEFAULT_CHART_BPM, beatsPerBar: 4, startSec: 0 }
/**
 * A tempo heard in music is rarely a whole number, and rounding it off lets the chords
 * drift from the music: 92.4 played as 92 is a second behind after three minutes.
 */
export const BPM_PRECISION = 100
