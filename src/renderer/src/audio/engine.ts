import recorderWorkletUrl from './worklets/recorder-worklet.js?url'
import { concatSamples } from './wav'

let context: AudioContext | null = null

export function getAudioContext(): AudioContext {
  context ??= new AudioContext({ sampleRate: 48000, latencyHint: 'interactive' })
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
  analyser.fftSize = 2048
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
  /** Begin capturing at `atTime` on the AudioContext clock. */
  start(atTime: number): void
  /** Resolves once the audio thread has flushed every captured sample. */
  stop(): Promise<Float32Array>
  dispose(): void
}

const workletModules = new WeakMap<BaseAudioContext, Promise<void>>()

export async function createRecorder(source: MediaStreamAudioSourceNode): Promise<Recorder> {
  const ctx = source.context
  let loading = workletModules.get(ctx)
  if (!loading) {
    loading = ctx.audioWorklet.addModule(recorderWorkletUrl)
    workletModules.set(ctx, loading)
  }
  await loading

  const node = new AudioWorkletNode(ctx, 'recorder-processor', {
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
  node.port.onmessage = (e) => {
    if (e.data.type === 'chunk') chunks.push(e.data.samples)
    else if (e.data.type === 'stopped') onStopped?.()
  }

  return {
    start(atTime) {
      chunks = []
      node.port.postMessage({ type: 'start', atFrame: Math.round(atTime * ctx.sampleRate) })
    },
    stop() {
      return new Promise((resolve) => {
        onStopped = () => {
          onStopped = null
          resolve(concatSamples(chunks))
        }
        node.port.postMessage({ type: 'stop' })
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
