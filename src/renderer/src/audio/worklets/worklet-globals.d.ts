// Globals of the AudioWorkletGlobalScope, which TypeScript's DOM lib doesn't describe.
// https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletGlobalScope

declare const sampleRate: number
declare const currentFrame: number

declare abstract class AudioWorkletProcessor {
  readonly port: MessagePort
  abstract process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>
  ): boolean
}

declare function registerProcessor(
  name: string,
  processorCtor: (new () => AudioWorkletProcessor) & {
    parameterDescriptors?: AudioParamDescriptor[]
  }
): void

interface AudioParamDescriptor {
  name: string
  defaultValue?: number
  minValue?: number
  maxValue?: number
  automationRate?: 'a-rate' | 'k-rate'
}
