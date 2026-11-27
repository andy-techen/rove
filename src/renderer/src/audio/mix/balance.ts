import { integratedLoudness } from '../export/loudness'
import { dbToGain } from '../dsp/units'

// How far above the music a voice sits when the mix sounds right, both measured as
// recorded (before Polish). Taken from a singer's own mix of a mastered pop backing:
// they set the music so their voice sat about 4 dB on top.
export const VOICE_OVER_MUSIC_DB = 4
// Quieter than about -30 dB the music is barely there; louder than as recorded it
// starts to clip once the voice joins it.
const MIN_MUSIC_VOLUME = 0.03
const MAX_MUSIC_VOLUME = 1
// A minute of singing is plenty to hear how loud someone sings.
const ANALYSIS_SEC = 60

/**
 * The backing track volume that puts this voice on top of this music, or null when
 * either is silent. Both are the same stretch of the song, as mono samples.
 */
export function balancedMusicVolume(
  voice: Float32Array,
  music: Float32Array,
  sampleRate: number
): number | null {
  const length = Math.min(voice.length, music.length, ANALYSIS_SEC * sampleRate)
  const voiceLufs = integratedLoudness([voice.subarray(0, length)], sampleRate)
  const musicLufs = integratedLoudness([music.subarray(0, length)], sampleRate)
  if (!Number.isFinite(voiceLufs) || !Number.isFinite(musicLufs)) return null
  const volume = dbToGain(voiceLufs - VOICE_OVER_MUSIC_DB - musicLufs)
  return Math.min(MAX_MUSIC_VOLUME, Math.max(MIN_MUSIC_VOLUME, volume))
}
