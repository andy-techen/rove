// The metronome's sound: a short, soft tick, higher on the first beat of a bar.

const ACCENT_HZ = 1600
const BEAT_HZ = 1000
const CLICK_SEC = 0.05
// Fast decay keeps the tick short and out of the way of the voice.
const DECAY_SEC = 0.008
const CLICK_LEVEL = 0.6
// Smooths a level change so turning the knob mid-tick doesn't crackle.
const LEVEL_RAMP_SEC = 0.015

const sounds = new WeakMap<BaseAudioContext, { accent: AudioBuffer; beat: AudioBuffer }>()

function tick(ctx: BaseAudioContext, hz: number): AudioBuffer {
  const length = Math.round(CLICK_SEC * ctx.sampleRate)
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) {
    const t = i / ctx.sampleRate
    data[i] = CLICK_LEVEL * Math.sin(2 * Math.PI * hz * t) * Math.exp(-t / DECAY_SEC)
  }
  return buffer
}

function soundsFor(ctx: BaseAudioContext): { accent: AudioBuffer; beat: AudioBuffer } {
  let made = sounds.get(ctx)
  if (!made) {
    made = { accent: tick(ctx, ACCENT_HZ), beat: tick(ctx, BEAT_HZ) }
    sounds.set(ctx, made)
  }
  return made
}

export interface ClickTrack {
  nodes: AudioBufferSourceNode[]
  /** Turns the click up or down while it plays. */
  setLevel(level: number): void
  /** Silences the clicks now, or from `atTime` on the audio clock. */
  stop(atTime?: number): void
}

/**
 * Schedules ticks at timeline times, with `fromSec` sounding at `atTime` on the context
 * clock. The click goes straight to the speakers: it's for the singer, never the mix.
 */
export function scheduleClicks(
  ctx: BaseAudioContext,
  clicks: { time: number; accent: boolean }[],
  fromSec: number,
  atTime: number,
  level: number
): ClickTrack {
  const { accent, beat } = soundsFor(ctx)
  const gain = ctx.createGain()
  gain.gain.value = level
  gain.connect(ctx.destination)
  const nodes = clicks.map((click) => {
    const node = ctx.createBufferSource()
    node.buffer = click.accent ? accent : beat
    node.connect(gain)
    node.start(atTime + (click.time - fromSec))
    return node
  })
  return {
    nodes,
    setLevel: (next) => gain.gain.setTargetAtTime(next, ctx.currentTime, LEVEL_RAMP_SEC),
    stop: (atTime) => {
      if (atTime === undefined) {
        for (const node of nodes) {
          node.stop()
          node.disconnect()
        }
        gain.disconnect()
        return
      }
      // A click scheduled after atTime never sounds; the ones before it finish as they were.
      let ringing = nodes.length
      for (const node of nodes) {
        node.stop(atTime)
        node.addEventListener('ended', () => {
          node.disconnect()
          if (--ringing === 0) gain.disconnect()
        })
      }
      if (ringing === 0) gain.disconnect()
    }
  }
}
