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
