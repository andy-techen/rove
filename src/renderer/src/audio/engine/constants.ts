// The audio context
// 48 kHz: the standard rate for video and most audio interfaces, and plenty for voice.
export const SAMPLE_RATE = 48000
// Analyser window for the level meter: ~43 ms at 48 kHz, enough to catch a peak.
export const METER_FFT_SIZE = 2048

// Latency
// Bluetooth headphones can add a quarter of a second or more that macOS doesn't report;
// anything past these is more likely a misheard take than a real delay.
export const LEARNED_MIN_SEC = -0.1
export const LEARNED_MAX_SEC = 0.5

// Lining a take up with the music
// A take's first minute and a half is plenty: the delay stays the same all the way.
export const ANALYSIS_SEC = 90
// How far to look. Singers are rarely early by much; a late take can be late by a
// Bluetooth headphone's quarter second. Wider would start matching the beat before.
export const EARLIEST_SEC = -0.1
export const LATEST_SEC = 0.3
// How clearly the voice's starts must follow the music's at the best lag, as a
// correlation, and how far that must stand above the typical lag's. Measured on real
// takes: a take 140 ms late scored 0.2 against a typical 0.06.
export const MIN_CORRELATION = 0.1
export const MIN_PROMINENCE = 0.05
/** Below this, a take is in time: too little to hear, so nothing is offered. */
export const MIN_LINE_UP_SEC = 0.02

// Lining harmonies up with the lead
// Fine enough to place a word's start; coarse enough to be quick over a whole take.
export const FRAME_SEC = 0.01
// Anything this far below the take's loud parts counts as a pause, so breaths and room
// noise don't join two phrases.
export const PAUSE_BELOW_LOUD_DB = 30
export const LOUD_PERCENTILE = 0.95
export const FLOOR_DB = -80
// A gap shorter than this is a breath between words, not the end of a phrase.
export const MIN_PAUSE_SEC = 0.2
// Shorter sounds are a click or a breath, not singing.
export const MIN_PHRASE_SEC = 0.15
// Harmonies sung against the lead drift by a word's consonant, not a beat; looking
// further would start matching the lead's next word.
export const MAX_SHIFT_SEC = 0.2
// How alike the harmony's rise and fall must be to the lead's at the best shift, as a
// correlation, before Rove trusts it. Words sung together score well above this.
export const MIN_MATCH = 0.5

// Setting the mic's input volume
// The loudest part of a song should peak here: in the meter's green, below "getting
// loud", with room for an even bigger note on the night.
export const TARGET_PEAK_DB = -10
// Mac inputs move roughly half a dB per step of the input volume. It's only roughly,
// so a second try lands closer; never more than this many steps at once.
export const STEPS_PER_DB = 2
export const MAX_STEPS = 40
// A clipped peak hides how loud the voice really was, so back off by at least this.
export const CLIPPED_DROP_DB = 12
// Within this of the target, leave the level alone.
export const CLOSE_ENOUGH_DB = 2
// Never turn the mic all the way off.
export const MIN_VOLUME = 5
