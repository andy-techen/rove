// The chord box, in its own units: six strings across, four frets down, with room
// above for open and muted marks and to the left for the starting fret.
export const STRINGS = 6
export const FRETS = 4
export const LEFT = 16
export const TOP = 14
export const STRING_GAP = 10
export const FRET_GAP = 13
export const WIDTH = LEFT + STRING_GAP * (STRINGS - 1) + 6
export const HEIGHT = TOP + FRET_GAP * FRETS + 4
export const DOT_R = 3.6
export const MARK_R = 2.6
export const MARK_Y = TOP - 7
