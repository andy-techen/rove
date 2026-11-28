import type { SongKey } from '../../audio/pitch/key'
import type { ChartPlace } from '../../state/chords/chart/chart'

/** The key whose chords a chart suggests before the song or its chords give one. */
export const FALLBACK_KEY: SongKey = { tonic: 0, mode: 'major' }

/** A new chart opens with its first bar picked. */
export const FIRST_BAR: ChartPlace = { bar: 0, slot: 0 }

/** The beat length an editor assumes when the song has no grid to give one. */
export const FALLBACK_SEC_PER_BEAT = 1
