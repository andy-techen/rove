import { integratedLoudness } from '../export/loudness'
import { dbToGain, gainToDb } from '../dsp/units'

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

// How far under the lead a harmony sits when it supports rather than competes, both
// heard through their faders. About where the 70% starting volume puts a harmony sung
// as loud as the lead.
export const HARMONY_UNDER_LEAD_DB = 3
// Quieter than this a harmony is lost under the lead; louder than as recorded it
// could clip once the lead joins it.
const MIN_HARMONY_VOLUME = 0.1
const MAX_HARMONY_VOLUME = 1
// A smaller change than this is too little to hear, so nothing is offered.
const MIN_HARMONY_CHANGE_DB = 2

/**
 * The volume that sets a harmony just under the lead, or null when it already sits
 * about right or either voice is silent. `lead` is the lead as heard (through its
 * faders) over the same stretch of the song; `volume` is the harmony's volume now.
 */
export function balancedHarmonyVolume(
  harmony: Float32Array,
  lead: Float32Array,
  volume: number,
  sampleRate: number
): number | null {
  const length = Math.min(harmony.length, lead.length, ANALYSIS_SEC * sampleRate)
  const harmonyLufs = integratedLoudness([harmony.subarray(0, length)], sampleRate)
  const leadLufs = integratedLoudness([lead.subarray(0, length)], sampleRate)
  if (!Number.isFinite(harmonyLufs) || !Number.isFinite(leadLufs)) return null
  const wanted = dbToGain(leadLufs - HARMONY_UNDER_LEAD_DB - harmonyLufs)
  const balanced = Math.min(MAX_HARMONY_VOLUME, Math.max(MIN_HARMONY_VOLUME, wanted))
  return Math.abs(gainToDb(balanced / volume)) < MIN_HARMONY_CHANGE_DB ? null : balanced
}
