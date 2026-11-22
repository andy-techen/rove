/**
 * In-place radix-2 FFT (Cooley–Tukey). `re` and `im` share one power-of-two length;
 * afterwards they hold the spectrum.
 */
export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      ;[re[i], re[j]] = [re[j], re[i]]
      ;[im[i], im[j]] = [im[j], im[i]]
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1
    const step = (-2 * Math.PI) / size
    for (let k = 0; k < half; k++) {
      const wr = Math.cos(step * k)
      const wi = Math.sin(step * k)
      for (let i = k; i < n; i += size) {
        const j = i + half
        const tr = re[j] * wr - im[j] * wi
        const ti = re[j] * wi + im[j] * wr
        re[j] = re[i] - tr
        im[j] = im[i] - ti
        re[i] += tr
        im[i] += ti
      }
    }
  }
}
