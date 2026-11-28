/** Decoded audio handed to an analysis: its channels and their sample rate. */
export interface AudioSource {
  channels: Float32Array[]
  sampleRate: number
}
