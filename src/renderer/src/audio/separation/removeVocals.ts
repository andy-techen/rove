import type { SeparateRequest, SeparationReply } from './messages'
import SeparationWorker from './separation.worker?worker'
import { clamp } from '../dsp/units'
import { SEGMENT_STEP, MAX_THREADS, SPARE_CORES } from './constants'

export interface RemoveVocalsOptions {
  /** 0 to 1, as the model works through the song. */
  onProgress(fraction: number): void
  signal: AbortSignal
}

/**
 * The song without its vocals, worked out in a background worker by SCNet. Resolves to one
 * array per channel at the song's own sample rate; rejects with an AbortError if stopped.
 */
export function removeVocals(
  song: AudioBuffer,
  model: Uint8Array,
  { onProgress, signal }: RemoveVocalsOptions
): Promise<Float32Array<ArrayBuffer>[]> {
  return new Promise((resolve, reject) => {
    const worker = new SeparationWorker()
    const finish = (): void => {
      worker.terminate()
      signal.removeEventListener('abort', stop)
    }
    const stop = (): void => {
      finish()
      reject(new DOMException('Vocal removal stopped', 'AbortError'))
    }
    if (signal.aborted) return stop()
    signal.addEventListener('abort', stop)

    worker.onmessage = ({ data }: MessageEvent<SeparationReply>) => {
      if (data.type === 'progress') return onProgress(data.done / data.total)
      finish()
      if (data.type === 'done') resolve(data.instrumental)
      else reject(new Error(data.message))
    }
    worker.onerror = (event) => {
      finish()
      reject(new Error(event.message))
    }

    const channels = Array.from({ length: song.numberOfChannels }, (_, c) =>
      song.getChannelData(c).slice()
    )
    const request: SeparateRequest = {
      type: 'separate',
      channels,
      sampleRate: song.sampleRate,
      model: model.slice(),
      threads: clamp(navigator.hardwareConcurrency - SPARE_CORES, 1, MAX_THREADS),
      step: SEGMENT_STEP
    }
    worker.postMessage(request, [...channels.map((ch) => ch.buffer), request.model.buffer])
  })
}
