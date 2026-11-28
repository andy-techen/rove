// Finding the sung pitch

/** How often the sung pitch is measured. */
export const PITCH_HOP_SEC = 0.01
// The range of singing voices, from a low bass to a high soprano.
export const MIN_F0_HZ = 70
export const MAX_F0_HZ = 1100
// Harmonics above this don't help find the fundamental.
export const ANALYSIS_CUTOFF_HZ = 2000
// Long enough to hold a couple of periods of the lowest note.
export const WINDOW_SEC = 0.025
// YIN's aperiodicity threshold: below it, a lag counts as the period. 0.1–0.2 is
// usual; higher accepts breathier voices at the risk of octave mistakes.
// http://audition.ens.fr/adc/pdf/2002_JASA_YIN.pdf
export const YIN_THRESHOLD = 0.15
// Quieter than this is room noise, not singing.
export const SILENCE_DB = -50
export const PITCH_FRAMES_PER_CHUNK = 500
// When the vocal folds fall into a two-cycle pattern (a rough or creaky note), YIN can
// take two cycles for one and read the note an octave low. A real fundamental always
// carries some energy, so if the sound at the found pitch is this far under the sound
// an octave up, the found pitch isn't there and the note is the octave above. Set on
// recorded takes: it caught three quarters of the octave-low readings and touched no
// pitch that sounded where it was read.
export const MISSING_FUNDAMENTAL_RATIO = 0.1
// Long enough to tell the lowest note from its octave in the spectrum.
export const SPECTRUM_SEC = 0.128

// Concert pitch
export const A4_HZ = 440
export const A4_MIDI = 69

// Finding the key
// Notes below and above this range are mostly drums, rumble and hiss.
export const CHROMA_MIN_HZ = 80
export const CHROMA_MAX_HZ = 2000
// ~0.34 s at the analysis rate: fine enough to tell neighbouring low notes apart.
export const FFT_SIZE = 4096
export const CHROMA_FRAMES_PER_CHUNK = 20
// Less total energy than this across a song means there's nothing to hear a key in.
export const MIN_CHROMA = 1e-3

// Tuning
// Tuning fixes notes; it never moves one far enough to change the melody.
export const MAX_CORRECTION_SEMITONES = 1
// A note has to drift this much closer to a neighbour before the target switches,
// so vibrato across the midpoint doesn't flicker between two notes.
export const HYSTERESIS_SEMITONES = 0.15
// Grains of 20 ms overlapping by half: short enough to follow a changing note, long
// enough to hold a couple of periods of a low voice.
export const GRAIN_HOP_SEC = 0.01
