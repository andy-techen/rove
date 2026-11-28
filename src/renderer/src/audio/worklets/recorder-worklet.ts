// Runs on the audio thread, bundled separately (see loadWorklets in ../engine/engine.ts).
import { RECORDER_PROCESSOR, RecorderCommand, RecorderEvent } from './messages'
import { CHUNK_SIZE } from './constants'

class RecorderProcessor extends AudioWorkletProcessor {
  private startFrame: number | null = null
  private buffer = new Float32Array(CHUNK_SIZE)
  private filled = 0

  constructor() {
    super()
    this.port.onmessage = (e: MessageEvent<RecorderCommand>) => {
      if (e.data.type === 'start') {
        this.startFrame = e.data.atFrame
        this.filled = 0
      } else {
        this.startFrame = null
        this.flush()
        this.send({ type: 'stopped' })
      }
    }
  }

  private send(event: RecorderEvent): void {
    this.port.postMessage(event)
  }

  private flush(): void {
    if (this.filled === 0) return
    this.send({ type: 'chunk', samples: this.buffer.slice(0, this.filled) })
    this.filled = 0
  }

  process(inputs: Float32Array[][]): boolean {
    const channel = inputs[0]?.[0]
    if (this.startFrame === null || !channel) return true
    // Capture begins on the exact frame the backing track is scheduled to start,
    // so the take lines up with the music on the shared context clock.
    const skip = Math.max(0, this.startFrame - currentFrame)
    for (let i = skip; i < channel.length; i++) {
      this.buffer[this.filled++] = channel[i]
      if (this.filled === CHUNK_SIZE) this.flush()
    }
    return true
  }
}

registerProcessor(RECORDER_PROCESSOR, RecorderProcessor)
