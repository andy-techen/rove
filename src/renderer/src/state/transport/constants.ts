// Metronome

// Most songs a beginner sings along to are in 4/4.
export const BEATS_PER_BAR = 4

// Playback and recording

// Scheduling slightly ahead lets the recorder's start message reach the audio
// thread before the frame the music starts on.
export const START_LEAD_SEC = 0.2
export const PLAY_LEAD_SEC = 0.05
export const MIN_TAKE_SEC = 0.5
// 10 ms of audio per live-waveform bucket at 48 kHz.
export const LIVE_BUCKET_SAMPLES = 480
// The live mic sits a little under the mix so it doesn't overpower the music.
export const MONITOR_GAIN = 0.8
// An edit made while playing is heard once it settles, so dragging a clip restarts
// playback once on release rather than on every pointer move.
export const EDIT_SETTLE_MS = 150

// Auto level

// Long enough to sing a big line; short enough to stay a quick check.
export const LISTEN_MS = 5000
export const READ_EVERY_MS = 50
