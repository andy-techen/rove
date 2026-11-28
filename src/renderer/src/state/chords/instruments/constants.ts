// Piano

// The left hand plays from E2 up to D#3: low enough to sound like the bass, high enough
// not to rumble under a voice.
export const BASS_LOWEST = 40
// The right hand starts from G3, so chords sit in the middle of the keyboard, under the
// singer, and move as little as possible from one chord to the next.
export const CHORD_LOWEST = 55
/**
 * Every note a voicing can play, E2 to F#4. The bundled samples cover exactly this; a
 * test keeps the voicings inside it.
 */
export const PIANO_RANGE = { low: 40, high: 66 } as const
// "Chords": the bass and the chord struck together once a bar and held, so the music
// moves slowly under the voice.
export const CHORDS_BASS_LEVEL = 0.75
export const CHORDS_LEVEL = 0.65
// "Flowing": the bass on one, then the chord's notes one a beat, low to high, all ringing
// under the pedal until the bar or the chord changes.
export const FLOWING_BASS_LEVEL = 0.75
export const FLOWING_LEVEL = 0.6
// A new chord is struck a little harder, so the change is heard.
export const PIANO_CHANGE_ACCENT = 1.15
// Times this close are the same moment (bar maths in floating point).
export const SAME_TIME = 1e-6
// A one-off chord is laid out as a bar of four beats, so it plays as the "Chords" feel does.
export const PREVIEW_BEATS = 4

// Guitar

// Standard tuning, low to high: E2 A2 D3 G3 B3 E4.
export const OPEN_STRINGS = [40, 45, 50, 55, 59, 64]
export const LOW_E = 0
export const A_STRING = 1
// The pitch classes of the low E and A strings.
export const E_ROOT = 4
export const A_ROOT = 9
// Up strums catch only the top strings, as a real strum on the way back up does.
export const UP_STRUM_LOWEST_STRING = 2
// A new chord is struck a little harder, so the change is heard.
export const STRUM_CHANGE_ACCENT = 1
// Each fingerpicked step is half a beat.
export const PICK_STEP_BEATS = 0.5
// A barre is drawn when one finger plainly holds several strings: the lowest fret
// used, on strings at least this far apart (so two neighbouring notes aren't one).
export const BARRE_MIN_SPAN = 3

// Playing like a person

// Players never strike two notes exactly alike: a small, repeatable variation in level.
export const VARIATION = 0.08
export const GOLDEN = 0.618034

// Drums

export const EIGHTHS_PER_BEAT = 2
// Hats off the beat play this much softer, so the bar has a pulse.
export const OFFBEAT_HAT = 0.7
// A fill keeps the groove for the first half of the bar, then runs down the snare in
// sixteenths, building up into whatever comes next.
export const FILL_STEP = 0.25
export const FILL_FROM_LEVEL = 0.5
// Taps snap to sixteenths: tight enough for any pop groove, loose enough to forgive.
export const SNAP_BEATS = 0.25
// Two taps of one drum closer than this are one hit: a loop pass replaying a tap, or a
// key pressed twice by accident.
export const SAME_HIT_BEATS = 0.0625
// Hit places are kept to a thousandth of a beat, so saved songs stay readable.
export const BEAT_PRECISION = 1000
// Drummers aren't machines: each hit lands a few milliseconds off and a little softer or
// harder. The wobble is worked out from the hit's place, so a part sounds the same every
// time it renders.
export const LOOSEN_SEC = 0.004
export const LOOSEN_VELOCITY = 0.08
// The well-known one-line hash from shader code: big, unrelated factors make the
// fractional part look random, yet the same input always gives the same output.
export const HASH_FREQUENCY = 12.9898
export const HASH_SCALE = 43758.5453
// Each bar's hits get their own run of wobbles: more than a bar ever holds.
export const HITS_PER_BAR_SEED = 64

// Previews and the beat pad

// Long enough to hear the chord ring, short enough to pick the next one.
export const PREVIEW_SEC = 1.5
// Quieter than the song, so trying chords while it plays doesn't drown it out.
export const PREVIEW_LEVEL = 0.8
// Long enough to hear and hum along with, then the key is let go and it dies away.
export const NOTE_HOLD_SEC = 1.2
// The pad's drums play louder than in the song's mix, where they sit under the voice: on
// their own, at the kit's level, the hats would be hard to hear. Taps and the loop use the
// same level, so what you tap sounds like what plays back.
const PAD_BOOST = 1.5
export const PAD_PLAY_LEVEL = PAD_BOOST * PREVIEW_LEVEL
// One bar of click alone, so the first tap can land on one.
export const COUNT_IN_BARS = 1
// The bar is played through once while recording, then recording stops by itself.
export const RECORD_BARS = 1
// How often to check whether the count-in, or the bar, is over.
export const CHECK_MS = 50

// Rendering

// Recent renders kept, so undo and redo are heard straight away.
export const CACHE_SIZE = 8
