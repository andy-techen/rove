/// <reference lib="webworker" />
import { load } from '@audio/neural-runtime'
import separate, { models, type Session } from '@audio/neural-separate'
import wasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url'
import type { SeparateRequest, SeparationReply } from './messages'

const reply = (message: SeparationReply, transfer: Transferable[] = []): void =>
  self.postMessage(message, transfer)

self.onmessage = async (event: MessageEvent<SeparateRequest>): Promise<void> => {
  const { channels, sampleRate, model, threads, step } = event.data
  const preset = models.scnet
  try {
    const { stems } = await separate(channels, {
      ...preset,
      sampleRate,
      step,
      model: { url: model, targets: preset.targets },
      // Our own loader: separate()'s doesn't pass a thread count through, and bundled,
      // onnxruntime-web can't find its .wasm by itself. The CPU build: on Apple silicon
      // it beat the GPU one for this model's LSTMs. The two packages type a tensor's
      // `type` differently (a string, a union of names) for the same objects.
      session: (spec) =>
        load(spec, {
          backend: 'wasm',
          wasmPaths: { wasm: wasmUrl },
          threads
        }) as unknown as Promise<Session>,
      progress: ({ chunk, totalChunks }) =>
        reply({ type: 'progress', done: chunk, total: totalChunks })
    })
    // The instrumental is the song less its vocals, so nothing else the model misjudged
    // (a guitar it heard as drums, say) goes missing.
    const instrumental = channels.map((channel, c) =>
      channel.map((sample, i) => sample - (stems.vocals[c]?.[i] ?? 0))
    )
    reply(
      { type: 'done', instrumental, sampleRate },
      instrumental.map((ch) => ch.buffer)
    )
  } catch (error) {
    reply({ type: 'error', message: error instanceof Error ? error.message : String(error) })
  }
}
