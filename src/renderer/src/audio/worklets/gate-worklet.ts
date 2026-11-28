// "Noise reduction": a gentle noise gate. Between phrases it turns the signal
// down by `range` dB rather than muting it, so breaths and tails don't chop off.
import { dbToGain } from '../dsp/units'
import { GATE_PROCESSOR } from './messages'
import {
  ATTACK_SEC,
  RELEASE_SEC,
  OPEN_SEC,
  CLOSE_SEC,
  HOLD_SEC,
  DEFAULT_THRESHOLD_DB,
  DEFAULT_RANGE_DB
} from './constants'

const coeff = (seconds: number): number => Math.exp(-1 / (seconds * sampleRate))

class GateProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors(): AudioParamDescriptor[] {
    return [
      {
        name: 'threshold',
        defaultValue: DEFAULT_THRESHOLD_DB,
        minValue: -100,
        maxValue: 0,
        automationRate: 'k-rate'
      },
      {
        name: 'range',
        defaultValue: DEFAULT_RANGE_DB,
        minValue: -60,
        maxValue: 0,
        automationRate: 'k-rate'
      }
    ]
  }

  private env = 0
  private gain = 1
  private hold = 0
  private readonly attack = coeff(ATTACK_SEC)
  private readonly release = coeff(RELEASE_SEC)
  private readonly open = coeff(OPEN_SEC)
  private readonly close = coeff(CLOSE_SEC)
  private readonly holdSamples = Math.round(HOLD_SEC * sampleRate)

  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>
  ): boolean {
    const input = inputs[0]
    const output = outputs[0]
    if (!input || input.length === 0) return true
    const threshold = dbToGain(parameters.threshold[0])
    const floor = dbToGain(parameters.range[0])
    for (let i = 0; i < input[0].length; i++) {
      let level = 0
      for (const channel of input) level = Math.max(level, Math.abs(channel[i]))
      const a = level > this.env ? this.attack : this.release
      this.env = a * this.env + (1 - a) * level
      let target = floor
      if (this.env > threshold) {
        this.hold = this.holdSamples
        target = 1
      } else if (this.hold > 0) {
        this.hold--
        target = 1
      }
      const g = target > this.gain ? this.open : this.close
      this.gain = g * this.gain + (1 - g) * target
      for (let ch = 0; ch < output.length; ch++) {
        output[ch][i] = (input[ch] ?? input[0])[i] * this.gain
      }
    }
    return true
  }
}

registerProcessor(GATE_PROCESSOR, GateProcessor)
