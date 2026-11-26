import {
  type PolishSettings,
  builtInMakeupDb,
  defaultPolish,
  polishParams
} from '@app/renderer/src/audio/polish/polish'
import { createSafetyLimiter, roomImpulse } from '@app/renderer/src/audio/mix/mixer'
import { dbToGain } from '@app/renderer/src/audio/dsp/units'
import type { DemoTracks, TrackId } from './tracks'

/** The controls the demo offers, each 0..1 as in the app. */
export type DemoControl = 'warmth' | 'clarity' | 'smoothness' | 'space'

// Matches the app's mixer: the same filter centres, so a slider sounds the same here.
const WARMTH_HZ = 250
const WARMTH_Q = 0.9
const PRESENCE_HZ = 3500
const PRESENCE_Q = 1
const AIR_HZ = 10000
const RAMP_SEC = 0.015
const REVERB_STEP_SEC = 0.2
// The backing sits under the voice, as in a fresh song.
const BACKING_LEVEL = 0.7

/**
 * Plays the demo song in a loop with the app's polish on the vocals. A trimmed copy of
 * the app's chain (no gate or de-esser: the demo has no room noise or sharp "s" sounds),
 * driven by the app's own slider mapping, so the sliders behave as they do in Rove.
 */
export class DemoPlayer {
  private readonly ctx = new AudioContext()
  private readonly gains: Record<TrackId, GainNode>
  private readonly bypass: GainNode
  private readonly polished: GainNode
  private readonly lowCut: BiquadFilterNode
  private readonly warmth: BiquadFilterNode
  private readonly comp: DynamicsCompressorNode
  private readonly makeup: GainNode
  private readonly presence: BiquadFilterNode
  private readonly air: BiquadFilterNode
  private readonly reverbSend: GainNode
  private readonly reverb: ConvolverNode
  private sources: AudioBufferSourceNode[] = []
  private startedAt = 0
  private offsetSec = 0
  private decay = 0
  private settings: PolishSettings = defaultPolish('lead')
  playing = false

  constructor(private readonly tracks: DemoTracks) {
    const c = this.ctx
    const filter = (type: BiquadFilterType, hz: number, q = Math.SQRT1_2): BiquadFilterNode => {
      const f = c.createBiquadFilter()
      f.type = type
      f.frequency.value = hz
      f.Q.value = q
      return f
    }
    const master = c.createGain()
    master.connect(createSafetyLimiter(c)).connect(c.destination)

    this.gains = { backing: c.createGain(), lead: c.createGain(), harmony: c.createGain() }
    this.gains.backing.gain.value = BACKING_LEVEL
    this.gains.backing.connect(master)

    const vocals = c.createGain()
    this.gains.lead.connect(vocals)
    this.gains.harmony.connect(vocals)
    this.bypass = c.createGain()
    this.polished = c.createGain()
    this.lowCut = filter('highpass', 90)
    this.warmth = filter('peaking', WARMTH_HZ, WARMTH_Q)
    this.comp = c.createDynamicsCompressor()
    this.makeup = c.createGain()
    this.presence = filter('peaking', PRESENCE_HZ, PRESENCE_Q)
    this.air = filter('highshelf', AIR_HZ)
    this.reverbSend = c.createGain()
    this.reverb = c.createConvolver()

    vocals.connect(this.bypass).connect(master)
    vocals.connect(this.lowCut).connect(this.warmth).connect(this.comp).connect(this.makeup)
    this.makeup.connect(this.presence).connect(this.air)
    this.air.connect(this.polished)
    this.air.connect(this.reverbSend).connect(this.reverb).connect(this.polished)
    this.polished.connect(master)
    this.apply(true)
  }

  get duration(): number {
    return this.tracks.backing.duration
  }

  /** Where playback is, 0..1 through the loop. */
  get position(): number {
    const sec = this.playing
      ? this.offsetSec + this.ctx.currentTime - this.startedAt
      : this.offsetSec
    return (sec % this.duration) / this.duration
  }

  async play(): Promise<void> {
    if (this.playing) return
    await this.ctx.resume()
    this.startedAt = this.ctx.currentTime
    this.sources = (Object.keys(this.gains) as TrackId[]).map((id) => {
      const source = this.ctx.createBufferSource()
      source.buffer = this.tracks[id]
      source.loop = true
      source.connect(this.gains[id])
      source.start(0, this.offsetSec % this.duration)
      return source
    })
    this.playing = true
  }

  pause(): void {
    if (!this.playing) return
    this.offsetSec = this.position * this.duration
    for (const s of this.sources) s.stop()
    this.sources = []
    this.playing = false
  }

  seek(fraction: number): void {
    const wasPlaying = this.playing
    this.pause()
    this.offsetSec = Math.max(0, Math.min(1, fraction)) * this.duration
    if (wasPlaying) void this.play()
  }

  setMuted(id: TrackId, muted: boolean): void {
    const level = id === 'backing' ? BACKING_LEVEL : 1
    this.gains[id].gain.setTargetAtTime(muted ? 0 : level, this.ctx.currentTime, RAMP_SEC)
  }

  setControl(control: DemoControl, amount: number): void {
    this.settings = { ...this.settings, [control]: amount }
    this.apply()
  }

  /** Off plays the voice untouched, to hear what polish did. */
  setPolishOn(on: boolean): void {
    this.settings = { ...this.settings, enabled: on }
    this.apply()
  }

  private apply(immediate = false): void {
    const set = (param: AudioParam, value: number): void => {
      if (immediate) param.value = value
      else param.setTargetAtTime(value, this.ctx.currentTime, RAMP_SEC)
    }
    const p = polishParams(this.settings)
    set(this.bypass.gain, this.settings.enabled ? 0 : 1)
    set(this.polished.gain, this.settings.enabled ? 1 : 0)
    set(this.lowCut.frequency, p.lowCutHz)
    set(this.warmth.gain, p.warmthDb)
    set(this.comp.threshold, p.compThresholdDb)
    set(this.comp.ratio, p.compRatio)
    set(this.makeup.gain, dbToGain(p.makeupDb - builtInMakeupDb(p.compThresholdDb, p.compRatio)))
    set(this.presence.gain, p.presenceDb)
    set(this.air.gain, p.airDb)
    set(this.reverbSend.gain, p.reverbMix)
    if (Math.abs(p.reverbDecaySec - this.decay) >= REVERB_STEP_SEC) {
      this.decay = p.reverbDecaySec
      this.reverb.buffer = roomImpulse(this.ctx, p.reverbDecaySec)
    }
  }
}
