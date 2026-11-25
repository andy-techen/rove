/// <reference lib="webworker" />
import type { SummariseReply, SummariseRequest } from './messages'
import { readWav } from './readWav'
import { summariseTake } from './summary'

const reply = (message: SummariseReply): void => self.postMessage(message)

self.onmessage = async (event: MessageEvent<SummariseRequest>): Promise<void> => {
  const { id, bytes, window } = event.data
  try {
    const { samples, sampleRate } = readWav(bytes)
    reply({ id, summary: await summariseTake(samples, sampleRate, window) })
  } catch (error) {
    reply({ id, error: error instanceof Error ? error.message : String(error) })
  }
}
