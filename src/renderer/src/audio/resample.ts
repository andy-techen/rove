// Analysis (pitch, key) only needs the low end of a voice or song, so it runs on a
// copy filtered and thinned out to roughly this rate: far less work, same answer.
const ANALYSIS_RATE = 12000
// Two passes of a Butterworth low-pass keep content above the new Nyquist from
// folding back down as false notes.
const PASSES = 2

/** Runs a second-order low-pass (RBJ cookbook, Butterworth Q) over `x` in place. */
function lowpass(x: Float32Array, sampleRate: number, cutoffHz: number): void {
  const w0 = (2 * Math.PI * cutoffHz) / sampleRate
  const alpha = Math.sin(w0) / (2 * Math.SQRT1_2)
  const cos = Math.cos(w0)
  const a0 = 1 + alpha
  const b0 = (1 - cos) / 2 / a0
  const b1 = (1 - cos) / a0
  const a1 = (-2 * cos) / a0
  const a2 = (1 - alpha) / a0
  let x1 = 0
  let x2 = 0
  let y1 = 0
  let y2 = 0
  for (let i = 0; i < x.length; i++) {
    const y = b0 * x[i] + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2
    x2 = x1
    x1 = x[i]
    y2 = y1
    y1 = y
    x[i] = y
  }
}

/** Mixes channels to mono and lowers the rate for analysis. */
export function downsampleForAnalysis(
  channels: Float32Array[],
  sampleRate: number,
  cutoffHz: number
): { data: Float32Array; rate: number } {
  const length = channels[0]?.length ?? 0
  const mono = new Float32Array(length)
  for (const channel of channels) {
    for (let i = 0; i < length; i++) mono[i] += channel[i] / channels.length
  }
  const factor = Math.max(1, Math.floor(sampleRate / ANALYSIS_RATE))
  for (let p = 0; p < PASSES; p++) lowpass(mono, sampleRate, cutoffHz)
  const data = new Float32Array(Math.floor(length / factor))
  for (let i = 0; i < data.length; i++) data[i] = mono[i * factor]
  return { data, rate: sampleRate / factor }
}

/** Lets the window repaint between chunks of a long analysis. */
export const nextTick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))
