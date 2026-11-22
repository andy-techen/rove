import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

interface Message {
  type: string
  samples?: Float32Array
}

interface Processor {
  port: { onmessage: (e: { data: unknown }) => void }
  process(inputs: Float32Array[][]): boolean
}

const g = globalThis as unknown as Record<string, unknown>
let ProcessorClass: new () => Processor
let posted: Message[]

beforeAll(async () => {
  g.AudioWorkletProcessor = class {
    port = { postMessage: (m: Message) => posted.push(m), onmessage: null }
  }
  g.registerProcessor = (_name: string, cls: new () => Processor) => {
    ProcessorClass = cls
  }
  await import('./recorder-worklet.js')
})

beforeEach(() => {
  posted = []
})

// Each sample's value is its absolute frame number, so captured audio shows
// exactly which frames were kept.
function runBlocks(processor: Processor, fromFrame: number, blocks: number): void {
  for (let b = 0; b < blocks; b++) {
    const start = fromFrame + b * 128
    g.currentFrame = start
    processor.process([[Float32Array.from({ length: 128 }, (_, i) => start + i)]])
  }
}

function send(processor: Processor, data: unknown): void {
  processor.port.onmessage({ data })
}

function captured(): number[] {
  return posted.flatMap((m) => (m.type === 'chunk' ? Array.from(m.samples!) : []))
}

describe('recorder worklet', () => {
  it('starts capturing on the exact scheduled frame, even mid-block', () => {
    const p = new ProcessorClass()
    send(p, { type: 'start', atFrame: 200 })
    runBlocks(p, 0, 2)
    send(p, { type: 'stop' })
    const frames = captured()
    expect(frames[0]).toBe(200)
    expect(frames).toHaveLength(56)
  })

  it('captures from the current block when the start frame has already passed', () => {
    const p = new ProcessorClass()
    send(p, { type: 'start', atFrame: 10 })
    runBlocks(p, 256, 1)
    send(p, { type: 'stop' })
    expect(captured()[0]).toBe(256)
  })

  it('flushes the partial chunk on stop, reports stopped, and captures nothing after', () => {
    const p = new ProcessorClass()
    send(p, { type: 'start', atFrame: 0 })
    runBlocks(p, 0, 3)
    send(p, { type: 'stop' })
    runBlocks(p, 384, 2)
    expect(captured()).toHaveLength(384)
    expect(posted.at(-1)).toEqual({ type: 'stopped' })
  })

  it('sends audio in batches rather than every block', () => {
    const p = new ProcessorClass()
    send(p, { type: 'start', atFrame: 0 })
    runBlocks(p, 0, 40)
    const chunks = posted.filter((m) => m.type === 'chunk')
    expect(chunks).toHaveLength(1)
    expect(chunks[0].samples).toHaveLength(4096)
  })

  it('keeps every frame contiguous across batches', () => {
    const p = new ProcessorClass()
    send(p, { type: 'start', atFrame: 0 })
    runBlocks(p, 0, 70)
    send(p, { type: 'stop' })
    const frames = captured()
    expect(frames).toHaveLength(70 * 128)
    expect(frames.every((f, i) => f === i)).toBe(true)
  })
})
