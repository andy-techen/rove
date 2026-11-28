import { dbToGain } from '../dsp/units'
import { DE_ESS_BAND } from '../dsp/constants'

// The level meter
export const METER_FLOOR_DB = -60
// Zone floors in dBFS. They aim a beginner at peaks around -12 dBFS: enough signal
// to work with, with headroom for the loudest notes before the 16-bit capture clips.
export const CLIP_DB = -1
export const LOUD_DB = -6
export const GOOD_DB = -24
export const QUIET_DB = -45
// Peak meter falls at this rate after a peak, so the bar is readable.
export const FALL_DB_PER_SEC = 24
// Time singing in the green before the level counts as checked.
export const LEVEL_CHECK_SEC = 1.5
// Longest frame gap counted toward that time (animation pauses in hidden windows).
export const MAX_COUNTED_FRAME_SEC = 0.5
// How far back hints look for the loudest moment.
export const HINT_WINDOW_SEC = 2.5

// Balancing voice and music
// How far above the music a voice sits when the mix sounds right, both measured as
// recorded (before Polish). Taken from a singer's own mix of a mastered pop backing:
// they set the music so their voice sat about 4 dB on top.
export const VOICE_OVER_MUSIC_DB = 4
// Quieter than about -30 dB the music is barely there; louder than as recorded it
// starts to clip once the voice joins it.
export const MIN_MUSIC_VOLUME = 0.03
export const MAX_MUSIC_VOLUME = 1
// A minute of singing is plenty to hear how loud someone sings.
export const ANALYSIS_SEC = 60
// How far under the lead a harmony sits when it supports rather than competes, both
// heard through their faders. About where the 70% starting volume puts a harmony sung
// as loud as the lead.
export const HARMONY_UNDER_LEAD_DB = 3
// Quieter than this a harmony is lost under the lead; louder than as recorded it
// could clip once the lead joins it.
export const MIN_HARMONY_VOLUME = 0.1
export const MAX_HARMONY_VOLUME = 1
// A smaller change than this is too little to hear, so nothing is offered.
export const MIN_HARMONY_CHANGE_DB = 2

// The mixer
// Smooths changes so dragging a slider during playback, or turning the click's knob
// mid-tick, doesn't click.
export const RAMP_SEC = 0.015
// Music tone: shelves low and high enough to read as "bass" and "brightness".
export const BASS_HZ = 120
export const BRIGHTNESS_HZ = 5000
// Filters. A Q of 1/√2 is a Butterworth response: flat, no resonant bump.
export const BUTTERWORTH_Q = Math.SQRT1_2
export const LOW_CUT_START_HZ = 90
export const WARMTH_HZ = 250
export const WARMTH_Q = 0.9
export const PRESENCE_HZ = 3500
export const PRESENCE_Q = 1
export const AIR_HZ = 10000
// Smoothness compressor: soft knee and vocal-friendly timing.
export const COMP_KNEE_DB = 10
export const COMP_ATTACK_SEC = 0.005
export const COMP_RELEASE_SEC = 0.15
// De-esser: compress only the band above the split, fast enough to catch an "s".
export const DE_ESS_SPLIT_HZ = DE_ESS_BAND[0]
export const DE_ESS_RATIO = 6
export const DE_ESS_KNEE_DB = 3
export const DE_ESS_ATTACK_SEC = 0.001
export const DE_ESS_RELEASE_SEC = 0.05
// Reverb: a generated room. Impulses are cached in steps of 1/IR_STEPS_PER_SEC s.
export const REVERB_PREDELAY_SEC = 0.015
export const IR_STEPS_PER_SEC = 5
export const IR_LEVEL = 0.5
// ln(1000): the exponent at which the tail has fallen 60 dB (the usual "decay time").
export const E_FOLDS_IN_60DB = Math.log(1000)
export const NOISE_SEED = 12345
// Safety limiter: just under full scale, effectively brick-wall.
export const LIMITER_THRESHOLD_DB = -1
export const LIMITER_RATIO = 20
export const LIMITER_ATTACK_SEC = 0.001
export const LIMITER_RELEASE_SEC = 0.1
// The volume slider is laid out in decibels so equal slider moves sound like equal
// changes in loudness: the bottom is silent, about 87% of the way is unity, the top is +6 dB.
export const SLIDER_MIN_DB = -40
export const SLIDER_MAX_DB = 6

// The metronome's click
export const ACCENT_HZ = 1600
export const BEAT_HZ = 1000
export const CLICK_SEC = 0.05
// Fast decay keeps the tick short and out of the way of the voice.
export const DECAY_SEC = 0.008
export const CLICK_LEVEL = 0.6

// Waveforms
// A waveform is drawn to fill its lane at its own loudest moment, so a vocal recorded
// with healthy headroom (peaking around -12 dB) reads as clearly as mastered music
// that peaks at 0 dB. Quieter than this peak it's mostly room noise: not blown up.
export const QUIETEST_FILLED_PEAK = dbToGain(-30)
// ~5 ms per bucket at 48 kHz: fine enough for any zoom the timeline offers, and a
// 3-minute song is only ~34k buckets to redraw from while dragging.
export const OVERVIEW_BUCKET = 256
