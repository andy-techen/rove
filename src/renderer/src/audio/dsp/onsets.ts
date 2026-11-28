import { fft, hann as hannWindow } from './fft'
import { downsampleForAnalysis, nextTick } from './resample'
import { AudioSource } from './audioSource'
import {
  ONSET_CUTOFF_HZ,
  ONSET_FFT,
  ONSET_HOP,
  LOG_COMPRESSION,
  FRAMES_PER_CHUNK,
  ONSET_PEAK_SHARE
} from './constants'

/** How strongly something new starts sounding in each analysis frame (spectral flux). */
export async function onsetStrength(
  source: AudioSource,
  maxSec: number
): Promise<{ envelope: Float32Array; rate: number; frameSec(frame: number): number }> {
  const length = Math.min(source.channels[0]?.length ?? 0, maxSec * source.sampleRate)
  const clipped = source.channels.map((c) => c.subarray(0, length))
  const { data, rate } = downsampleForAnalysis(clipped, source.sampleRate, ONSET_CUTOFF_HZ)
  const frames = Math.max(0, Math.floor((data.length - ONSET_FFT) / ONSET_HOP))
  const envelope = new Float32Array(frames)
  const re = new Float64Array(ONSET_FFT)
  const im = new Float64Array(ONSET_FFT)
  const hann = hannWindow(ONSET_FFT, true)
  const previous = new Float64Array(ONSET_FFT / 2)
  for (let f = 0; f < frames; f++) {
    for (let i = 0; i < ONSET_FFT; i++) re[i] = data[f * ONSET_HOP + i] * hann[i]
    im.fill(0)
    fft(re, im)
    let flux = 0
    for (let bin = 1; bin < ONSET_FFT / 2; bin++) {
      const level = Math.log1p(LOG_COMPRESSION * Math.hypot(re[bin], im[bin]))
      if (f > 0) flux += Math.max(0, level - previous[bin])
      previous[bin] = level
    }
    envelope[f] = flux
    if ((f + 1) % FRAMES_PER_CHUNK === 0) await nextTick()
  }
  return {
    envelope,
    rate: rate / ONSET_HOP,
    // As frames move past a new sound, the Hann window's weight on it rises fastest when
    // it sits three-quarters of the way in: that frame is where the flux peaks.
    frameSec: (frame) => (frame * ONSET_HOP + ONSET_FFT * ONSET_PEAK_SHARE) / rate
  }
}
