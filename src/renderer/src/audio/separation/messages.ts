// What the page and the vocal removal worker say to each other.

export interface SeparateRequest {
  type: 'separate'
  /** The song, one array per channel. */
  channels: Float32Array[]
  sampleRate: number
  /** The SCNet model file's bytes. */
  model: Uint8Array
  /** CPU threads for onnxruntime-web (more than one needs cross-origin isolation). */
  threads: number
  /** How far apart the model's 11 s segments start, as a fraction of one. */
  step: number
}

export type SeparationReply =
  | { type: 'progress'; done: number; total: number }
  | { type: 'done'; instrumental: Float32Array<ArrayBuffer>[]; sampleRate: number }
  | { type: 'error'; message: string }
