import { SongKey, scaleOf } from '../audio/key'
import { polishParams } from '../audio/polish'
import { Tuning } from '../audio/tuning'
import { Track, polishOf } from './project'

const MS_PER_SEC = 1000

/** How a track's takes are tuned, or null when they play as sung. */
export function tuningOf(track: Track, key: SongKey | null): Tuning | null {
  if (track.role !== 'vocal') return null
  const polish = polishOf(track)
  if (!polish.enabled) return null
  const { tuneStrength, retuneMs } = polishParams(polish)
  if (tuneStrength <= 0) return null
  return { strength: tuneStrength, retuneSec: retuneMs / MS_PER_SEC, scale: scaleOf(key) }
}
