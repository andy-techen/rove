// Shared between the audio-thread processors and the main-thread code that drives them.

export const RECORDER_PROCESSOR = 'recorder-processor'
export const GATE_PROCESSOR = 'gate-processor'

export type RecorderCommand = { type: 'start'; atFrame: number } | { type: 'stop' }

export type RecorderEvent = { type: 'chunk'; samples: Float32Array } | { type: 'stopped' }
