import type { DrumHit } from '../../state/chords/beats'
import { scheduleClicks, ClickTrack } from '../mix/click'
import { drum, drumLevel } from './drums'

// Bars are scheduled a little ahead of time, on a timer that wakes often enough never to
// leave a gap: the usual way to keep Web Audio in time without a worklet.
const LOOKAHEAD_SEC = 0.2
const WAKE_MS = 25
// Time to set the first bar up before it sounds.
const START_DELAY_SEC = 0.1
const CLICK_LEVEL = 0.5

export interface BeatLoopOptions {
  secPerBeat: number
  beatsPerBar: number
  /** Bars of click alone before the beat comes in. */
  countInBars: number
  /** Bars to play after the count-in, then stop. */
  bars: number
  /** The bar's hits, `time` in seconds from its start; read afresh for every bar. */
  hits(): DrumHit[]
  /** How loud the drums play. */
  level: number
}

export interface BeatLoop {
  /**
   * Where a tap made now falls, as the singer heard it: beats into the bar, whether the
   * count-in is over, and whether every bar has played.
   */
  tapAt(): LoopPlace
  stop(): void
}

export interface LoopPlace {
  counting: boolean
  /** Beats into the bar. */
  at: number
  done: boolean
}

/** Where `heardSec` after the loop started falls in it. */
export function loopPlace(
  heardSec: number,
  { secPerBeat, beatsPerBar, countInBars, bars }: Omit<BeatLoopOptions, 'hits' | 'level'>
): LoopPlace {
  const barSec = secPerBeat * beatsPerBar
  const bar = Math.floor(heardSec / barSec)
  return {
    counting: bar < countInBars,
    at: (heardSec - bar * barSec) / secPerBeat,
    done: bar >= countInBars + bars
  }
}

const buffers = new WeakMap<BaseAudioContext, Map<string, AudioBuffer>>()

function bufferFor(ctx: BaseAudioContext, voice: DrumHit['voice']): AudioBuffer {
  let made = buffers.get(ctx)
  if (!made) buffers.set(ctx, (made = new Map()))
  let buffer = made.get(voice)
  if (!buffer) {
    const samples = drum(voice, ctx.sampleRate)
    buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate)
    buffer.copyToChannel(samples as Float32Array<ArrayBuffer>, 0)
    made.set(voice, buffer)
  }
  return buffer
}

/**
 * Plays a bar `bars` times with a click on every beat, counting in first, and reports
 * where taps land in it. A change to the hits is heard from the next time round.
 */
export function startBeatLoop(ctx: AudioContext, options: BeatLoopOptions): BeatLoop {
  const { secPerBeat, beatsPerBar, countInBars, bars } = options
  const barSec = secPerBeat * beatsPerBar
  const startTime = ctx.currentTime + START_DELAY_SEC
  const out = ctx.createGain()
  out.gain.value = options.level
  out.connect(ctx.destination)
  const playing = new Set<AudioBufferSourceNode>()
  const clicks: ClickTrack[] = []
  let scheduled = 0

  const scheduleBar = (bar: number): void => {
    const barStart = startTime + bar * barSec
    const beats = Array.from({ length: beatsPerBar }, (_, k) => ({
      time: k * secPerBeat,
      accent: k === 0
    }))
    clicks.push(scheduleClicks(ctx, beats, 0, barStart, CLICK_LEVEL))
    if (bar < countInBars) return
    for (const hit of options.hits()) {
      const source = ctx.createBufferSource()
      const gain = ctx.createGain()
      source.buffer = bufferFor(ctx, hit.voice)
      gain.gain.value = drumLevel(hit.voice) * hit.velocity
      source.connect(gain).connect(out)
      source.addEventListener('ended', () => {
        gain.disconnect()
        playing.delete(source)
      })
      source.start(barStart + hit.time)
      playing.add(source)
    }
  }

  const wake = (): void => {
    while (
      scheduled < countInBars + bars &&
      startTime + scheduled * barSec < ctx.currentTime + LOOKAHEAD_SEC
    )
      scheduleBar(scheduled++)
  }
  wake()
  const timer = setInterval(wake, WAKE_MS)

  return {
    tapAt() {
      // The singer taps to what they hear, which left the speakers a moment after it
      // was played.
      const heard = ctx.currentTime - (ctx.outputLatency || ctx.baseLatency || 0) - startTime
      return loopPlace(heard, options)
    },
    stop() {
      clearInterval(timer)
      for (const source of playing) {
        try {
          source.stop()
        } catch {
          // Already over.
        }
      }
      for (const click of clicks) click.stop()
      out.disconnect()
    }
  }
}
