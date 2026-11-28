import type { Band } from './voiceBands'

// Analysis copies
// Analysis (pitch, key) only needs the low end of a voice or song, so it runs on a
// copy filtered and thinned out to roughly this rate: far less work, same answer.
export const ANALYSIS_RATE = 12000
// Two passes of a Butterworth low-pass keep content above the new Nyquist from
// folding back down as false notes.
export const PASSES = 2

// Changed copies of recordings
// The last few versions of each recording, so moving a slider back and forth is instant
// without holding every version ever made (each is a full copy of the audio).
export const KEEP_VERSIONS = 3

// Onsets
// Drums, plucks and sung consonants live across the spectrum; above this adds little.
export const ONSET_CUTOFF_HZ = 5000
export const ONSET_FFT = 1024
export const ONSET_HOP = 128
export const LOG_COMPRESSION = 100
export const FRAMES_PER_CHUNK = 400
export const ONSET_PEAK_SHARE = 0.75

// Voice bands
export const FRAME = 2048
export const HOP = FRAME / 2
// Bands, in Hz. The mixer's de-esser splits at DE_ESS_BAND's lower edge.
export const VOICED_BAND: Band = [80, 5000]
export const SIBILANT_BAND: Band = [5000, Infinity]
export const HUM_BAND: Band = [0, 150]
export const DE_ESS_BAND: Band = [6000, Infinity]
export const BODY_BAND: Band = [150, 400]
export const MID_BAND: Band = [1000, 2000]
export const PRESENCE_BAND: Band = [2500, 5000]
export const AIR_BAND: Band = [8000, 12000]
// Below this the whole recording is silence.
export const SILENCE_DB = -70
// Singing sits at least this far over the room, and within this far of the loudest moments.
export const SINGING_OVER_ROOM_DB = 10
export const SINGING_UNDER_LOUD_DB = 30
// Share of a frame's energy that marks it as voiced.
export const VOICED_SHARE = 0.5
export const PERCENT = { loud: 0.95, roomGuess: 0.1 }
