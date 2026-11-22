import type { ExportFormat } from '@shared/exportFormats'
import { SAMPLE_RATE, loadWorklets } from './engine'
import { integratedLoudness, levelGainDb, withPeakCeiling } from './loudness'
import { Mixer, TrackMix } from './mixer'
import { encodeMp3 } from './mp3'
import { scheduleClips } from './playback'
import { dbToGain } from './units'
import { encodeWav } from './wav'

export type { ExportFormat }
export type ExportLoudness = 'streaming' | 'loud' | 'asMixed'

/**
 * Integrated loudness to aim for. Spotify, YouTube and Tidal play songs at about
 * -14 LUFS, so a mix there plays as mixed; "loud" suits sharing outside them.
 * https://support.spotify.com/us/artists/article/loudness-normalization/
 */
export const LOUDNESS_TARGET_LUFS: Record<Exclude<ExportLoudness, 'asMixed'>, number> = {
  streaming: -14,
  loud: -10
}
// Headroom for MP3 encoding and cheap converters, which overshoot a 0 dBFS peak.
const PEAK_CEILING_DB = -1
const STEREO = 2

export interface MixdownTrack extends TrackMix {
  clips: {
    buffer: AudioBuffer
    start: number
    offset: number
    duration: number
    fadeIn?: number
    fadeOut?: number
  }[]
}

export type ExportStage =
  { stage: 'mixing' } | { stage: 'levelling' } | { stage: 'encoding'; progress: number }

/** Renders the song through the same chains as playback, with the master at `gainDb`. */
async function renderMix(
  tracks: MixdownTrack[],
  lengthSec: number,
  gainDb: number
): Promise<Float32Array[]> {
  const ctx = new OfflineAudioContext(STEREO, Math.ceil(lengthSec * SAMPLE_RATE), SAMPLE_RATE)
  await loadWorklets(ctx)
  const mixer = new Mixer(ctx)
  mixer.master.gain.value = dbToGain(gainDb)
  mixer.sync(tracks.map((t, i) => ({ ...t, id: String(i) })))
  const clips = tracks.flatMap((t, i) =>
    t.clips.map((c) => ({ ...c, output: mixer.input(String(i)) }))
  )
  scheduleClips(ctx, clips, 0, 0)
  const rendered = await ctx.startRendering()
  return [rendered.getChannelData(0), rendered.getChannelData(1)]
}

/**
 * Mixes the song down, levels it to the chosen loudness, and encodes it. Levelling
 * renders twice: once to measure, once with the gain in front of the limiter, so a
 * louder export is limited rather than clipped.
 */
export async function exportMix(
  tracks: MixdownTrack[],
  lengthSec: number,
  options: { format: ExportFormat; loudness: ExportLoudness },
  onStage: (stage: ExportStage) => void
): Promise<Uint8Array<ArrayBuffer>> {
  onStage({ stage: 'mixing' })
  let channels = await renderMix(tracks, lengthSec, 0)
  if (options.loudness !== 'asMixed') {
    onStage({ stage: 'levelling' })
    const measured = integratedLoudness(channels, SAMPLE_RATE)
    const gainDb = levelGainDb(measured, LOUDNESS_TARGET_LUFS[options.loudness])
    if (gainDb !== 0) channels = await renderMix(tracks, lengthSec, gainDb)
  }
  channels = withPeakCeiling(channels, PEAK_CEILING_DB)
  onStage({ stage: 'encoding', progress: 0 })
  if (options.format === 'wav') return new Uint8Array(encodeWav(channels, SAMPLE_RATE, 24))
  return encodeMp3(channels, SAMPLE_RATE, (progress) => onStage({ stage: 'encoding', progress }))
}
