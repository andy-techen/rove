import { useState } from 'react'
import { ExportFormat, ExportLoudness, ExportStage, exportMix } from '../../audio/export/exportMix'
import { mixdownOf } from './selectors'
import { processProject } from '../processing/processedAudio'
import { songKeyOf } from '../processing/songKey'
import { usePlan } from '../license/useFeature'
import { Song } from './useSong'
import { ChordPart } from '../chords/chart/chart'
import { SongLyrics } from '../lyrics/lyrics'
import { VideoOptions, VideoScene } from '../../audio/export/videoFrame'
import { MS_PER_SEC } from '@shared/units'
import { TimeLeft, timeLeft } from './timeLeft'

export interface ExportOptions {
  format: ExportFormat
  loudness: ExportLoudness
  /** The picture, words and lyrics for a video (mp4) export. */
  video?: VideoOptions
}

/** Decodes the singer's picture and picks the lyrics to show, ready to draw. */
async function sceneOf(
  video: VideoOptions,
  lyrics: SongLyrics | null | undefined
): Promise<VideoScene> {
  const { background } = video
  return {
    ...video,
    background:
      background.kind === 'picture'
        ? { kind: 'picture', image: await createImageBitmap(background.file) }
        : background,
    lyrics: video.lyrics ? (lyrics ?? null) : null
  }
}

export type ExportState =
  | { status: 'idle' }
  | {
      status: 'working'
      stage: ExportStage | { stage: 'tuning' } | { stage: 'saving' }
      /** How long encoding has left, once there's enough progress to tell. */
      timeLeft?: TimeLeft | null
    }
  | { status: 'done'; filePath: string }
  | { status: 'failed' }

export interface Exporter {
  state: ExportState
  /** Asks where to save, then mixes, levels, encodes and writes the song there. */
  start(options: ExportOptions): Promise<void>
  reveal(): void
  /** Shares the saved file: AirDrop to a phone, Messages, Mail and so on. */
  share(): void
  reset(): void
}

/** Exporting one song's mix to a file the person picks, with the chords as they sound now. */
export function useExport(song: Song, parts: ChordPart[]): Exporter {
  const [state, setState] = useState<ExportState>({ status: 'idle' })
  const plan = usePlan()
  return {
    state,
    start: async (options) => {
      const open = song.song
      if (!open) return
      // Ask where first, so nobody waits through a mixdown only to cancel.
      const filePath = await window.api.chooseExportPath(open.data.name, options.format)
      if (!filePath) return
      try {
        // Usually already tuned for playback, so this is quick.
        setState({ status: 'working', stage: { stage: 'tuning' } })
        const key = await songKeyOf(open.data, song.audio)
        const processed = await processProject(open.data, song.audio, key, plan)
        const { tracks, lengthSec } = mixdownOf(open.data, song.audio, processed, parts)
        const video = options.video && (await sceneOf(options.video, open.data.lyrics))
        let encodingSince = 0
        const bytes = await exportMix(tracks, lengthSec, { ...options, video }, (stage) => {
          if (stage.stage !== 'encoding') return setState({ status: 'working', stage })
          if (stage.progress === 0) encodingSince = performance.now()
          const elapsedSec = (performance.now() - encodingSince) / MS_PER_SEC
          setState({ status: 'working', stage, timeLeft: timeLeft(stage.progress, elapsedSec) })
        })
        setState({ status: 'working', stage: { stage: 'saving' } })
        await window.api.writeExport(filePath, bytes)
        setState({ status: 'done', filePath })
      } catch {
        setState({ status: 'failed' })
      }
    },
    reveal: () => {
      if (state.status === 'done') void window.api.revealExport(state.filePath)
    },
    share: () => {
      if (state.status === 'done') void window.api.shareExport(state.filePath)
    },
    reset: () => setState({ status: 'idle' })
  }
}
