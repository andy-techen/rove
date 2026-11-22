// `?worker&url` has Vite compile each processor (and its imports) into its own file.
import gateWorkletUrl from '../worklets/gate-worklet.ts?worker&url'
import recorderWorkletUrl from '../worklets/recorder-worklet.ts?worker&url'
import { RECORDER_PROCESSOR, RecorderCommand, RecorderEvent } from '../worklets/messages'
import { concatSamples } from '../encode/wav'

// 48 kHz: the standard rate for video and most audio interfaces, and plenty for voice.
export const SAMPLE_RATE = 48000
// Analyser window for the level meter: ~43 ms at 48 kHz, enough to catch a peak.
const METER_FFT_SIZE = 2048

let context: AudioContext | null = null

export function getAudioContext(): AudioContext {
  context ??= new AudioContext({ sampleRate: SAMPLE_RATE, latencyHint: 'interactive' })
  return context
}

export async function listInputs(): Promise<MediaDeviceInfo[]> {
  const devices = await navigator.mediaDevices.enumerateDevices()
  return devices.filter((d) => d.kind === 'audioinput')
}

// Browser voice processing is built for calls and makes sung vocals pump and warble.
export function openInput(deviceId?: string): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: {
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      channelCount: 1
    }
  })
}

export function closeInput(stream: MediaStream): void {
  stream.getTracks().forEach((t) => t.stop())
}

export interface Meter {
  readPeak(): number
  dispose(): void
}

export function createMeter(source: MediaStreamAudioSourceNode): Meter {
  const analyser = source.context.createAnalyser()
  analyser.fftSize = METER_FFT_SIZE
  source.connect(analyser)
  const buffer = new Float32Array(analyser.fftSize)

  return {
    readPeak() {
      analyser.getFloatTimeDomainData(buffer)
      let peak = 0
      for (const s of buffer) peak = Math.max(peak, Math.abs(s))
      return peak
    },
    dispose() {
      source.disconnect(analyser)
    }
  }
}

export interface Recorder {
  /** Begin capturing at `atTime` on the AudioContext clock; `onChunk` sees audio as it arrives. */
  start(atTime: number, onChunk?: (samples: Float32Array) => void): void
  /** Resolves once the audio thread has flushed every captured sample. */
  stop(): Promise<Float32Array<ArrayBuffer>>
  dispose(): void
}

const workletModules = new WeakMap<BaseAudioContext, Promise<void>>()

/** Loads Rove's audio-thread processors into a context (live or offline) once. */
export function loadWorklets(ctx: BaseAudioContext): Promise<void> {
  let loading = workletModules.get(ctx)
  if (!loading) {
    loading = Promise.all([
      ctx.audioWorklet.addModule(recorderWorkletUrl),
      ctx.audioWorklet.addModule(gateWorkletUrl)
    ]).then(() => undefined)
    workletModules.set(ctx, loading)
  }
  return loading
}

export async function createRecorder(source: MediaStreamAudioSourceNode): Promise<Recorder> {
  const ctx = source.context
  await loadWorklets(ctx)

  const node = new AudioWorkletNode(ctx, RECORDER_PROCESSOR, {
    channelCount: 1,
    channelCountMode: 'explicit'
  })
  // A muted path to the destination keeps the browser pulling audio through the node.
  const silent = ctx.createGain()
  silent.gain.value = 0
  source.connect(node)
  node.connect(silent).connect(ctx.destination)

  let chunks: Float32Array[] = []
  let onStopped: (() => void) | null = null
  let listener: ((samples: Float32Array) => void) | undefined
  const send = (command: RecorderCommand): void => node.port.postMessage(command)
  node.port.onmessage = (e: MessageEvent<RecorderEvent>) => {
    if (e.data.type === 'chunk') {
      chunks.push(e.data.samples)
      listener?.(e.data.samples)
    } else if (e.data.type === 'stopped') onStopped?.()
  }

  return {
    start(atTime, onChunk) {
      chunks = []
      listener = onChunk
      send({ type: 'start', atFrame: Math.round(atTime * ctx.sampleRate) })
    },
    stop() {
      return new Promise((resolve) => {
        onStopped = () => {
          onStopped = null
          resolve(concatSamples(chunks))
        }
        send({ type: 'stop' })
      })
    },
    dispose() {
      node.port.onmessage = null
      source.disconnect(node)
      node.disconnect()
      silent.disconnect()
    }
  }
}

export function decodeAudio(bytes: Uint8Array): Promise<AudioBuffer> {
  const copy = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  return getAudioContext().decodeAudioData(copy as ArrayBuffer)
}
