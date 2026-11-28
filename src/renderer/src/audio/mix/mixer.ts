import {
  PolishParams,
  PolishSettings,
  builtInMakeupDb,
  defaultPolish,
  polishParams
} from '../polish/polish'
import { GATE_PROCESSOR } from '../worklets/messages'
import { clamp, dbToGain, gainToDb } from '../dsp/units'
import { DE_ESS_BAND } from '../dsp/voiceBands'
import { seededNoise } from '../dsp/noise'

export interface TrackMix {
  role: 'vocal' | 'backing'
  /** Linear gain: 1 is unity, 0 silent. */
  volume: number
  /** -1 full left, 0 centre, 1 full right. */
  pan: number
  muted: boolean
  /** Vocal tracks only. */
  polish?: PolishSettings
  /** Backing tracks only: the music's bass and brightness, in dB. */
  tone?: { bassDb: number; brightnessDb: number }
}

// Music tone: shelves low and high enough to read as "bass" and "brightness".
const BASS_HZ = 120
const BRIGHTNESS_HZ = 5000

// Smooths changes so dragging a slider during playback doesn't click.
const RAMP_SEC = 0.015

// Filters. A Q of 1/√2 is a Butterworth response: flat, no resonant bump.
const BUTTERWORTH_Q = Math.SQRT1_2
const LOW_CUT_START_HZ = 90
const WARMTH_HZ = 250
const WARMTH_Q = 0.9
const PRESENCE_HZ = 3500
const PRESENCE_Q = 1
const AIR_HZ = 10000

// Smoothness compressor: soft knee and vocal-friendly timing.
const COMP_KNEE_DB = 10
const COMP_ATTACK_SEC = 0.005
const COMP_RELEASE_SEC = 0.15

// De-esser: compress only the band above the split, fast enough to catch an "s".
const DE_ESS_SPLIT_HZ = DE_ESS_BAND[0]
const DE_ESS_RATIO = 6
const DE_ESS_KNEE_DB = 3
const DE_ESS_ATTACK_SEC = 0.001
const DE_ESS_RELEASE_SEC = 0.05

// Reverb: a generated room. Impulses are cached in steps of 1/IR_STEPS_PER_SEC s.
const REVERB_PREDELAY_SEC = 0.015
const IR_STEPS_PER_SEC = 5
const IR_LEVEL = 0.5
// ln(1000): the exponent at which the tail has fallen 60 dB (the usual "decay time").
const E_FOLDS_IN_60DB = Math.log(1000)
const NOISE_SEED = 12345

// Safety limiter: just under full scale, effectively brick-wall.
const LIMITER_THRESHOLD_DB = -1
const LIMITER_RATIO = 20
const LIMITER_ATTACK_SEC = 0.001
const LIMITER_RELEASE_SEC = 0.1

type Setter = (param: AudioParam, value: number) => void

const rampSetter =
  (ctx: BaseAudioContext): Setter =>
  (param, value) =>
    param.setTargetAtTime(value, ctx.currentTime, RAMP_SEC)
const immediateSetter: Setter = (param, value) => {
  param.value = value
}

const impulses = new WeakMap<BaseAudioContext, Map<number, AudioBuffer>>()

/** A simple room: decaying stereo noise, cached per context and decay time. */
export function roomImpulse(ctx: BaseAudioContext, decaySec: number): AudioBuffer {
  const key = Math.round(decaySec * IR_STEPS_PER_SEC) / IR_STEPS_PER_SEC
  let byDecay = impulses.get(ctx)
  if (!byDecay) impulses.set(ctx, (byDecay = new Map()))
  const cached = byDecay.get(key)
  if (cached) return cached
  const sr = ctx.sampleRate
  const pre = Math.round(REVERB_PREDELAY_SEC * sr)
  const length = pre + Math.round(key * sr)
  const buffer = ctx.createBuffer(2, length, sr)
  const noise = seededNoise(NOISE_SEED)
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch)
    for (let i = pre; i < length; i++) {
      data[i] = noise() * Math.exp((-E_FOLDS_IN_60DB * (i - pre)) / (key * sr)) * IR_LEVEL
    }
  }
  byDecay.set(key, buffer)
  return buffer
}

/**
 * The polish effects for one vocal track:
 * gate → low cut → warmth → de-esser → compressor → makeup → presence → air → dry + room.
 * Turning polish off crossfades to the untouched signal.
 */
class PolishChain {
  readonly input: GainNode
  readonly output: GainNode
  private readonly bypass: GainNode
  private readonly polished: GainNode
  private readonly gate: AudioWorkletNode
  private readonly lowCut: BiquadFilterNode
  private readonly warmth: BiquadFilterNode
  private readonly deEssComp: DynamicsCompressorNode
  private readonly comp: DynamicsCompressorNode
  private readonly makeup: GainNode
  private readonly presence: BiquadFilterNode
  private readonly air: BiquadFilterNode
  private readonly reverbSend: GainNode
  private readonly reverb: ConvolverNode
  private readonly nodes: AudioNode[]
  private decay = 0

  constructor(private readonly ctx: BaseAudioContext) {
    const gain = (): GainNode => ctx.createGain()
    const filter = (type: BiquadFilterType, freq: number, q = BUTTERWORTH_Q): BiquadFilterNode => {
      const f = ctx.createBiquadFilter()
      f.type = type
      f.frequency.value = freq
      f.Q.value = q
      return f
    }
    this.input = gain()
    this.output = gain()
    this.bypass = gain()
    this.polished = gain()
    this.gate = new AudioWorkletNode(ctx, GATE_PROCESSOR)
    this.lowCut = filter('highpass', LOW_CUT_START_HZ)
    this.warmth = filter('peaking', WARMTH_HZ, WARMTH_Q)
    this.presence = filter('peaking', PRESENCE_HZ, PRESENCE_Q)
    this.air = filter('highshelf', AIR_HZ)
    this.makeup = gain()
    this.comp = ctx.createDynamicsCompressor()
    this.comp.knee.value = COMP_KNEE_DB
    this.comp.attack.value = COMP_ATTACK_SEC
    this.comp.release.value = COMP_RELEASE_SEC

    // De-esser: split at 6 kHz with paired 2nd-order filters (a Linkwitz–Riley
    // crossover), compress only the top band, then sum the bands back together.
    const lowBand = [filter('lowpass', DE_ESS_SPLIT_HZ), filter('lowpass', DE_ESS_SPLIT_HZ)]
    const highBand = [filter('highpass', DE_ESS_SPLIT_HZ), filter('highpass', DE_ESS_SPLIT_HZ)]
    this.deEssComp = ctx.createDynamicsCompressor()
    this.deEssComp.ratio.value = DE_ESS_RATIO
    this.deEssComp.knee.value = DE_ESS_KNEE_DB
    this.deEssComp.attack.value = DE_ESS_ATTACK_SEC
    this.deEssComp.release.value = DE_ESS_RELEASE_SEC
    const deEssSum = gain()

    const dry = gain()
    this.reverbSend = gain()
    this.reverb = ctx.createConvolver()
    const wetDry = gain()

    this.input.connect(this.bypass).connect(this.output)
    this.input.connect(this.gate).connect(this.lowCut).connect(this.warmth)
    this.warmth.connect(lowBand[0]).connect(lowBand[1]).connect(deEssSum)
    this.warmth.connect(highBand[0]).connect(highBand[1]).connect(this.deEssComp).connect(deEssSum)
    deEssSum.connect(this.comp).connect(this.makeup).connect(this.presence).connect(this.air)
    this.air.connect(dry).connect(wetDry)
    this.air.connect(this.reverbSend).connect(this.reverb).connect(wetDry)
    wetDry.connect(this.polished).connect(this.output)

    this.nodes = [
      this.input,
      this.output,
      this.bypass,
      this.polished,
      this.gate,
      this.lowCut,
      this.warmth,
      ...lowBand,
      ...highBand,
      this.deEssComp,
      deEssSum,
      this.comp,
      this.makeup,
      this.presence,
      this.air,
      dry,
      this.reverbSend,
      this.reverb,
      wetDry
    ]
  }

  apply(settings: PolishSettings, set: Setter): void {
    const p: PolishParams = polishParams(settings)
    set(this.bypass.gain, settings.enabled ? 0 : 1)
    set(this.polished.gain, settings.enabled ? 1 : 0)
    set(this.gate.parameters.get('threshold')!, p.gateThresholdDb)
    set(this.lowCut.frequency, p.lowCutHz)
    set(this.warmth.gain, p.warmthDb)
    set(this.deEssComp.threshold, p.deEssThresholdDb)
    set(this.comp.threshold, p.compThresholdDb)
    set(this.comp.ratio, p.compRatio)
    set(this.makeup.gain, dbToGain(p.makeupDb - builtInMakeupDb(p.compThresholdDb, p.compRatio)))
    set(this.presence.gain, p.presenceDb)
    set(this.air.gain, p.airDb)
    set(this.reverbSend.gain, p.reverbMix)
    // Swapping the room is a buffer change, so only do it when the decay really moves.
    if (Math.abs(p.reverbDecaySec - this.decay) >= 0.2) {
      this.decay = p.reverbDecaySec
      this.reverb.buffer = roomImpulse(this.ctx, p.reverbDecaySec)
    }
  }

  dispose(): void {
    for (const node of this.nodes) node.disconnect()
  }
}

/**
 * One track's signal path: input → [polish, vocal tracks only] → volume → position → output.
 * Works on a live AudioContext and on an OfflineAudioContext for export. The
 * context must have Rove's worklets loaded (see loadWorklets).
 */
export class TrackChain {
  readonly input: GainNode
  private readonly polish: PolishChain | null
  private readonly bass: BiquadFilterNode | null
  private readonly brightness: BiquadFilterNode | null
  private readonly volume: GainNode
  private readonly panner: StereoPannerNode

  constructor(
    private readonly ctx: BaseAudioContext,
    output: AudioNode,
    role: TrackMix['role']
  ) {
    this.input = ctx.createGain()
    this.volume = ctx.createGain()
    this.panner = ctx.createStereoPanner()
    this.polish = role === 'vocal' ? new PolishChain(ctx) : null
    const shelf = (type: BiquadFilterType, hz: number): BiquadFilterNode => {
      const f = ctx.createBiquadFilter()
      f.type = type
      f.frequency.value = hz
      return f
    }
    this.bass = role === 'backing' ? shelf('lowshelf', BASS_HZ) : null
    this.brightness = role === 'backing' ? shelf('highshelf', BRIGHTNESS_HZ) : null
    if (this.polish) {
      this.input.connect(this.polish.input)
      this.polish.output.connect(this.volume)
    } else if (this.bass && this.brightness) {
      this.input.connect(this.bass).connect(this.brightness).connect(this.volume)
    } else {
      this.input.connect(this.volume)
    }
    this.volume.connect(this.panner).connect(output)
  }

  /** Smoothly moves to new settings while audio is playing. */
  set(mix: TrackMix): void {
    this.apply(mix, rampSetter(this.ctx))
  }

  /** Applies settings immediately, for a new chain or offline rendering. */
  setNow(mix: TrackMix): void {
    this.apply(mix, immediateSetter)
  }

  private apply(mix: TrackMix, set: Setter): void {
    set(this.volume.gain, mix.muted ? 0 : mix.volume)
    set(this.panner.pan, clamp(mix.pan, -1, 1))
    this.polish?.apply(mix.polish ?? defaultPolish(), set)
    if (this.bass) set(this.bass.gain, mix.tone?.bassDb ?? 0)
    if (this.brightness) set(this.brightness.gain, mix.tone?.brightnessDb ?? 0)
  }

  dispose(): void {
    this.input.disconnect()
    this.polish?.dispose()
    this.bass?.disconnect()
    this.brightness?.disconnect()
    this.volume.disconnect()
    this.panner.disconnect()
  }
}

/**
 * A brick-wall-style limiter just under full scale: however tracks are stacked or
 * pushed, the mix never clips. Used on the live master and in export.
 */
export function createSafetyLimiter(ctx: BaseAudioContext): DynamicsCompressorNode {
  const limiter = ctx.createDynamicsCompressor()
  limiter.threshold.value = LIMITER_THRESHOLD_DB
  limiter.knee.value = 0
  limiter.ratio.value = LIMITER_RATIO
  limiter.attack.value = LIMITER_ATTACK_SEC
  limiter.release.value = LIMITER_RELEASE_SEC
  return limiter
}

/**
 * One chain per track, summed into a master bus and the safety limiter. Runs live and,
 * on an OfflineAudioContext, for export, so the export sounds exactly like playback.
 */
export class Mixer {
  readonly master: GainNode
  private readonly chains = new Map<string, TrackChain>()

  constructor(private readonly ctx: BaseAudioContext) {
    this.master = ctx.createGain()
    // The limiter's own makeup gain is cancelled so it only ever turns peaks down.
    const limiter = createSafetyLimiter(ctx)
    const trim = ctx.createGain()
    trim.gain.value = dbToGain(-builtInMakeupDb(LIMITER_THRESHOLD_DB, LIMITER_RATIO))
    this.master.connect(limiter).connect(trim).connect(ctx.destination)
  }

  sync(tracks: ({ id: string } & TrackMix)[]): void {
    const ids = new Set(tracks.map((t) => t.id))
    for (const [id, chain] of this.chains) {
      if (!ids.has(id)) {
        chain.dispose()
        this.chains.delete(id)
      }
    }
    for (const track of tracks) {
      let chain = this.chains.get(track.id)
      if (!chain) {
        chain = new TrackChain(this.ctx, this.master, track.role)
        chain.setNow(track)
        this.chains.set(track.id, chain)
      } else {
        chain.set(track)
      }
    }
  }

  input(trackId: string): AudioNode {
    return this.chains.get(trackId)?.input ?? this.master
  }
}

// The volume slider is laid out in decibels so equal slider moves sound like equal
// changes in loudness: the bottom is silent, about 87% of the way is unity, the top is +6 dB.
const SLIDER_MIN_DB = -40
const SLIDER_MAX_DB = 6

export function sliderToGain(position: number): number {
  if (position <= 0) return 0
  return dbToGain(SLIDER_MIN_DB + position * (SLIDER_MAX_DB - SLIDER_MIN_DB))
}

export function gainToSlider(gain: number): number {
  if (gain <= 0) return 0
  const db = gainToDb(gain)
  return clamp((db - SLIDER_MIN_DB) / (SLIDER_MAX_DB - SLIDER_MIN_DB), 0, 1)
}
