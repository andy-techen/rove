import type { ExportFormat } from '@shared/exportFormats'
import { loadWorklets } from '../engine/engine'
import { SAMPLE_RATE } from '../engine/constants'
import { integratedLoudness, levelGainDb, withPeakCeiling } from './loudness'
import { Mixer, TrackMix } from '../mix/mixer'
import { encodeMp3 } from '../encode/mp3'
import { scheduleClips } from '../mix/playback'
import { dbToGain } from '../dsp/units'
import { encodeWav } from '../encode/wav'
import { encodeMp4 } from '../encode/mp4'
import { VIDEO_HEIGHT, VIDEO_WIDTH, VideoScene, drawVideoFrame, frameKey } from './videoFrame'
import { STREAMING_LUFS, PEAK_CEILING_DB, STEREO } from './constants'

export type { ExportFormat }
export type ExportLoudness = 'streaming' | 'asMixed'

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

/** Puts the mix under the video's picture, drawing a frame only when the picture changes. */
function encodeVideo(
  channels: Float32Array[],
  scene: VideoScene,
  onProgress: (progress: number) => void
): Promise<Uint8Array<ArrayBuffer>> {
  const canvas = document.createElement('canvas')
  canvas.width = VIDEO_WIDTH
  canvas.height = VIDEO_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No canvas to draw the video on')
  let drawn: string | null = null
  const draw = (timeSec: number): void => {
    const key = frameKey(scene, timeSec)
    if (key === drawn) return
    drawVideoFrame(ctx, scene, timeSec)
    drawn = key
  }
  return encodeMp4(channels, SAMPLE_RATE, canvas, draw, onProgress)
}

/**
 * Mixes the song down, levels it to the chosen loudness, and encodes it. Levelling
 * renders twice: once to measure, once with the gain in front of the limiter, so a
 * louder export is limited rather than clipped.
 */
export async function exportMix(
  tracks: MixdownTrack[],
  lengthSec: number,
  options: { format: ExportFormat; loudness: ExportLoudness; video?: VideoScene },
  onStage: (stage: ExportStage) => void
): Promise<Uint8Array<ArrayBuffer>> {
  onStage({ stage: 'mixing' })
  let channels = await renderMix(tracks, lengthSec, 0)
  if (options.loudness !== 'asMixed') {
    onStage({ stage: 'levelling' })
    const measured = integratedLoudness(channels, SAMPLE_RATE)
    const gainDb = levelGainDb(measured, STREAMING_LUFS)
    if (gainDb !== 0) channels = await renderMix(tracks, lengthSec, gainDb)
  }
  channels = withPeakCeiling(channels, PEAK_CEILING_DB)
  onStage({ stage: 'encoding', progress: 0 })
  const onProgress = (progress: number): void => onStage({ stage: 'encoding', progress })
  if (options.format === 'wav') return new Uint8Array(encodeWav(channels, SAMPLE_RATE, 24))
  if (options.format === 'mp4') {
    if (!options.video) throw new Error('A video needs a picture')
    return encodeVideo(channels, options.video, onProgress)
  }
  return encodeMp3(channels, SAMPLE_RATE, onProgress)
}
