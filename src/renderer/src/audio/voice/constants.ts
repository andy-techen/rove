import type { Band } from '../dsp/voiceBands'
import { BITS_PER_BYTE } from '../encode/constants'
import { AIR_BAND, BODY_BAND, PRESENCE_BAND } from '../dsp/constants'
import type { Tone } from './profile'

// Summing up a take
// A note has to be held this long to count towards range, time on each note and
// landing: shorter runs are slides, ornaments and the odd octave slip in the pitch
// tracker, which would stretch the range with notes the singer passes through rather
// than sings.
export const HELD_NOTE_SEC = 0.15
// A jump bigger than this between hops is a new note, not vibrato or drift.
export const NOTE_CHANGE_SEMITONES = 0.7
// Wandering further than this from where a run has sat so far is a new note too: a
// singer gliding between notes never jumps from one hop to the next, so the jump test
// alone would join the notes and measure the slide. Wide enough for vibrato.
export const NOTE_DRIFT_SEMITONES = 0.6
// A note's first and last moments are the scoop into it and the fall away; landing
// listens to the steady middle.
export const NOTE_EDGE_SHARE = 0.25
// A held note whose steady middle still moves this far from one half to the other is
// a slide, not a note, so it says nothing about where the singer lands.
export const STEADY_SEMITONES = 0.25

// The voice profile
// The comfort zone is where most of the singing sits: the notes below which 5% and
// above which 5% of the sung time falls, so a stray low or high note doesn't stretch it.
export const COMFORT_PERCENT = { low: 0.05, high: 0.95 }
// A held note within this many cents of the note counts as landing on it. Most
// listeners don't hear a held note as out of tune until it's 20–25 cents off.
export const LANDED_CENTS = 20
/**
 * Where each tone measure (per Hz, relative to 1–2 kHz) sits from 0 to 1. Centred on
 * auto polish's TONE_REFERENCE, so a typical voice lands mid-scale. Starting values;
 * tune by ear across voices and mics.
 */
export const TONE_RANGE_DB: Record<keyof Tone, { band: Band; low: number; high: number }> = {
  body: { band: BODY_BAND, low: -5, high: 25 },
  brightness: { band: PRESENCE_BAND, low: -23, high: 7 },
  air: { band: AIR_BAND, low: -45, high: -5 }
}
export const MONTHS_PER_YEAR = 12

// Reading takes (16-bit PCM WAV)
export const BITS = 16
export const BYTES_PER_SAMPLE = BITS / BITS_PER_BYTE
export const FULL_SCALE = 0x8000
export const RIFF_HEADER_BYTES = 12
export const CHUNK_HEADER_BYTES = 8
