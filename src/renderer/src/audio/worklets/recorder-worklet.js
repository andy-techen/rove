// Runs on the audio thread. Kept dependency-free because it is loaded as a
// standalone module, outside the Vite bundle.

// ~85 ms at 48 kHz: batching keeps cross-thread message traffic low.
const CHUNK_SIZE = 4096

class RecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.startFrame = null
    this.buffer = new Float32Array(CHUNK_SIZE)
    this.filled = 0
    this.port.onmessage = (e) => {
      if (e.data.type === 'start') {
        this.startFrame = e.data.atFrame
        this.filled = 0
      } else if (e.data.type === 'stop') {
        this.startFrame = null
        this.flush()
        this.port.postMessage({ type: 'stopped' })
      }
    }
  }

  flush() {
    if (this.filled === 0) return
    this.port.postMessage({ type: 'chunk', samples: this.buffer.slice(0, this.filled) })
    this.filled = 0
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0]
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

registerProcessor('recorder-processor', RecorderProcessor)
