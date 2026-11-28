import type { DrumVoice } from '../../state/chords/instruments/beats'

// Rendering instruments yields to the page this often, so a long chart doesn't freeze it.
export const EVENTS_PER_CHUNK = 64

// Guitar (a plucked string, synthesised: see guitar.ts)
/** How long a single pluck rings before it's cut. */
export const PLUCK_SEC = 3
// How long the lowest string takes to die away by 60 dB; higher strings ring shorter.
export const LOW_RING_SEC = 3.5
export const LOW_STRING_HZ = 82
// A 60 dB fall is three powers of ten in amplitude.
export const DECADES_IN_60DB = 3
// Softens the noise burst, like a soft pick or a thumb: a warm, round tone. Brighter
// settings sound harsh, and their strong upper harmonics blur which chord is playing.
export const PICK_SMOOTHING = 0.93
export const GUITAR_NOISE_SEED = 2718
// A doubled note gets its own noise burst, so the two voices don't sound like one.
export const SEED_STEPS = 100
// A strum isn't instant: the pick crosses the strings one after another.
export const DOWN_SPREAD_SEC = 0.012
export const UP_SPREAD_SEC = 0.008
// Each voice's level in the mix: six strings, each doubled, stay under full scale.
export const GUITAR_NOTE_LEVEL = 0.16
// Every note is played twice, the second a touch sharp and a moment late, as when a part
// is double-tracked: the two beat gently against each other and the guitar sounds full
// rather than thin.
export const DOUBLE_CENTS = 7
export const DOUBLE_DELAY_SEC = 0.009
export const DOUBLE_LEVEL = 0.75
// A guitar body's warmth: the low end, under about 250 Hz, lifted by half again.
export const WARMTH_HZ = 250
export const WARMTH = 0.5
// A string struck again stops its last note; a short fade keeps that from clicking.
export const DAMP_SEC = 0.01
// Takes the top off, like a guitar's body does.
export const BODY_SMOOTHING = 0.35
/** How long the last chord rings after the chart ends. */
export const RING_OUT_SEC = 2
// The doubled voice of a string is held under its own key, beside the string's.
export const DOUBLE_VOICE = 0.5

// Piano
// Each voice's level: a bass note and a four-note chord struck together stay under full
// scale, and the piano sits about as loud as the guitar's fingerpicking.
export const PIANO_NOTE_LEVEL = 0.18
// How long a note takes to die away once its key, or the pedal, is let go: a damper
// settling on the string.
export const RELEASE_SEC = 0.25
// A key struck again while still sounding stops its last note; a short fade keeps that
// from clicking.
export const RESTRIKE_SEC = 0.02
/** How long the last chord rings after the chart ends. */
export const PIANO_RING_OUT_SEC = 2
// Where a note starts: within 40 dB of its loudest, less a moment so the hammer's attack
// is kept. AAC adds a few milliseconds of silence before the sound (encoder priming),
// which would otherwise make every note late.
export const ONSET_LEVEL = 0.01
export const ONSET_LEAD_SEC = 0.001

// Drums (each synthesised once per sample rate)
export const DRUM_NOISE_SEED = 1618
// Kick: a low sine that drops in pitch as it dies, the thump of a bass drum.
export const KICK = { sec: 0.45, fromHz: 140, toHz: 48, sweepSec: 0.05, decaySec: 0.14 }
// Snare: a short tone for the drum, under a burst of noise for the wires.
export const SNARE = { sec: 0.25, hz: 190, toneSec: 0.04, wiresSec: 0.07, wiresHz: 1500, tone: 0.5 }
// Hats: high, bright noise; closed is a tick, open rings a little.
export const HAT = { sec: 0.08, decaySec: 0.018, hz: 7000 }
export const OPEN_HAT = { sec: 0.4, decaySec: 0.12, hz: 6000 }
// Rim: a short knock, for quiet bars.
export const RIM = { sec: 0.05, hz: 1700, decaySec: 0.008, click: 0.4 }
// Clap: a few hands a moment apart, then the room.
export const CLAP = {
  sec: 0.3,
  hz: 1200,
  burstGapSec: 0.011,
  bursts: 3,
  burstSec: 0.004,
  tailSec: 0.06
}
// Tom: a tuned drum, a fifth or so above the kick, that sags in pitch as it rings.
export const TOM = { sec: 0.5, fromHz: 190, toHz: 120, sweepSec: 0.08, decaySec: 0.18 }
// Crash: a big wash of bright noise that takes a while to die.
export const CRASH = { sec: 1.6, hz: 4500, decaySec: 0.55 }
// Each drum's level in the kit. Quiet beside the guitar, and the hats quieter still: the
// voice is the star. Even every drum struck at once, full force, stays well under 1.
export const LEVEL: Record<DrumVoice, number> = {
  kick: 0.34,
  snare: 0.22,
  clap: 0.16,
  rim: 0.12,
  hat: 0.06,
  openHat: 0.06,
  tom: 0.22,
  crash: 0.08
}
// The loudest a render may be. Every drum at once, hard, could pass it, so a render that
// would is turned down as a whole: quieter, never clipped.
export const CEILING = 0.9
/** The longest any drum rings, so a render can leave room after its last bar. */
export const DRUM_TAIL_SEC = CRASH.sec

// The beat pad's loop
// Bars are scheduled a little ahead of time, on a timer that wakes often enough never to
// leave a gap: the usual way to keep Web Audio in time without a worklet.
export const LOOKAHEAD_SEC = 0.2
export const WAKE_MS = 25
// Time to set the first bar up before it sounds.
export const START_DELAY_SEC = 0.1
export const CLICK_LEVEL = 0.5

// Hearing chords
// Chords live in the bass and middle; above this is mostly cymbals and breath.
export const CUTOFF_HZ = 2000
export const LOW_HZ = 60
export const HOP = 1024
// Without a beat to follow, chords are judged half a second at a time.
export const BLOCK_SEC = 0.5
// What it costs to change chord between blocks: enough to stop a passing note
// flipping the name back and forth, small enough to follow real changes.
export const CHANGE_COST = 0.12
// How well a block must fit some chord to be named at all.
export const NO_CHORD_SCORE = 0.55
export const FRAMES_PER_CHUNK = 200

// Tempo
// The tempo is steady through most songs; a minute and a half is plenty to hear it.
export const TEMPO_ANALYSIS_SEC = 90
export const MIN_BPM = 60
export const MAX_BPM = 200
// Songs cluster around 120 BPM. Weighting toward it settles half- and double-time
// mix-ups the way a listener would (Ellis, "Beat Tracking by Dynamic Programming").
export const PREFERRED_BPM = 120
export const PREFERENCE_OCTAVES = 1
// Reading the beat across four of them pins the tempo far finer than one beat could.
export const REFINE_BEATS = 4
// Below this much onset energy there are no beats to hear.
export const MIN_ONSET_ENERGY = 1e-3
// How firmly beats keep to the song's tempo: high enough to step over a fill or a
// rest, low enough to follow a band that speeds up or drags.
export const BEAT_TIGHTNESS = 400

// Speed and pitch
// WSOLA: overlapping 50 ms frames, each nudged by up to 10 ms to line up with what
// came before, so beats and notes stay clean at a new speed.
// https://www.researchgate.net/publication/2391829 (Verhelst & Roelands, 1993)
export const FRAME_SEC = 0.05
export const SEEK_SEC = 0.01
// Lining frames up uses a thinned-out copy: alignment needs the shape, not the detail.
export const GUIDE_STEP = 8
export const FRAMES_PER_YIELD = 200
// Raising the pitch reads the audio faster, which would fold its top octave back
// down as noise; a low-pass just under the new Nyquist stops that.
export const ANTI_ALIAS_SHARE = 0.45
