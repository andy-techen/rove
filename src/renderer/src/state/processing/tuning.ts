import { SongKey, scaleOf } from '../../audio/pitch/key'
import { polishParams } from '../../audio/polish/polish'
import { Tuning } from '../../audio/pitch/tuning'
import { Track, polishOf } from '../song/project'

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
