import { Plan, isEnabled } from '@shared/features'
import { SongKey, scaleOf } from '../../audio/pitch/key'
import { polishParams } from '../../audio/polish/polish'
import { Tuning } from '../../audio/pitch/tuning'
import { Track, polishOf } from '../song/project'

const MS_PER_SEC = 1000

/**
 * How a track's takes are tuned, or null when they play as sung. Tuning is premium: on
 * the free plan a song tuned earlier plays as sung, and its setting waits in the project.
 */
export function tuningOf(track: Track, key: SongKey | null, plan: Plan): Tuning | null {
  if (track.role !== 'vocal' || !isEnabled('tuning', plan)) return null
  const polish = polishOf(track)
  if (!polish.enabled) return null
  const { tuneStrength, retuneMs } = polishParams(polish)
  if (tuneStrength <= 0) return null
  return { strength: tuneStrength, retuneSec: retuneMs / MS_PER_SEC, scale: scaleOf(key) }
}
