// License keys
// Keys are typed or pasted; anything longer than this isn't one.
export const MAX_KEY_LENGTH = 200
// Lemon Squeezy keys are 36 characters; anything much shorter is a typo or a paste gone
// wrong. The fake turns those down so the error message can be tried.
export const MIN_KEY_LENGTH = 8

// The fake license service
// Long enough to see "Activating…", as a real request would show it.
export const FAKE_DELAY_MS = 600
