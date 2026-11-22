import { useState } from 'react'
import { ExportFormat, ExportLoudness, ExportStage, exportMix } from '../../audio/export/exportMix'
import { mixdownOf } from './selectors'
import { processProject } from '../processing/processedAudio'
import { songKeyOf } from '../processing/songKey'
import { Song } from './useSong'

export interface ExportOptions {
  format: ExportFormat
  loudness: ExportLoudness
}

export type ExportState =
  | { status: 'idle' }
  | { status: 'working'; stage: ExportStage | { stage: 'tuning' } | { stage: 'saving' } }
  | { status: 'done'; filePath: string }
  | { status: 'failed' }

export interface Exporter {
  state: ExportState
  /** Asks where to save, then mixes, levels, encodes and writes the song there. */
  start(options: ExportOptions): Promise<void>
  reveal(): void
  reset(): void
}

/** Exporting one song's mix to a file the person picks. */
export function useExport(song: Song): Exporter {
  const [state, setState] = useState<ExportState>({ status: 'idle' })
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
        const processed = await processProject(open.data, song.audio, key)
        const { tracks, lengthSec } = mixdownOf(open.data, song.audio, processed)
        const bytes = await exportMix(tracks, lengthSec, options, (stage) =>
          setState({ status: 'working', stage })
        )
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
    reset: () => setState({ status: 'idle' })
  }
}
