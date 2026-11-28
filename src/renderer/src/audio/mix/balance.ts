import { integratedLoudness } from '../export/loudness'
import { dbToGain, gainToDb } from '../dsp/units'
import {
  VOICE_OVER_MUSIC_DB,
  MIN_MUSIC_VOLUME,
  MAX_MUSIC_VOLUME,
  ANALYSIS_SEC,
  HARMONY_UNDER_LEAD_DB,
  MIN_HARMONY_VOLUME,
  MAX_HARMONY_VOLUME,
  MIN_HARMONY_CHANGE_DB
} from './constants'

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
