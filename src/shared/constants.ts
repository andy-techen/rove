// Constants shared by the main process and the renderer.

/** Longest song name: plenty for a title, and safe as a folder name. */
export const SONG_NAME_MAX_LENGTH = 100

/** Recent songs on the welcome screen and in the Dock menu; the Songbook holds the rest. */
export const RECENT_SONGS = 5

/** A song or wishlist note is a reminder ("learn the bridge", who it's for), not a diary. */
export const SONG_NOTE_MAX_LENGTH = 200
