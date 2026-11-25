import type { TakeSummary } from '@shared/voice'
import type { SummariseReply, SummariseRequest } from './messages'
import type { TakeWindow } from './summary'
import VoiceWorker from './voice.worker?worker'

interface Pending {
  resolve(summary: TakeSummary): void
  reject(error: Error): void
}

// One worker for every take, started on first use, so listening through a whole
// Songbook doesn't start a thread per take.
let worker: Worker | null = null
let nextId = 0
const pending = new Map<number, Pending>()

function start(): Worker {
  const started = new VoiceWorker()
  started.onmessage = ({ data }: MessageEvent<SummariseReply>) => {
    const request = pending.get(data.id)
    pending.delete(data.id)
    if ('summary' in data) request?.resolve(data.summary)
    else request?.reject(new Error(data.error))
  }
  // A crashed worker takes every waiting take with it; the next call starts afresh.
  started.onerror = (event) => {
    for (const request of pending.values()) request.reject(new Error(event.message))
    pending.clear()
    started.terminate()
    worker = null
  }
  return started
}

/**
 * What one take's played window adds to the voice profile, worked out off the page.
 * The bytes are handed over to the worker, so don't use them afterwards.
 */
export function summariseInWorker(bytes: Uint8Array, window: TakeWindow): Promise<TakeSummary> {
  worker ??= start()
  const id = nextId++
  const request: SummariseRequest = { id, bytes, window }
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    worker?.postMessage(request, [bytes.buffer])
  })
}
