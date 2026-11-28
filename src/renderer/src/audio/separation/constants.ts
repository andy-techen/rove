// Segments start every half segment: half the work of the model's usual quarter, for
// about 0.1 dB less separation (measured by @audio/neural-separate on MUSDB18).
export const SEGMENT_STEP = 0.5
// Past 8 threads the model gains nothing on Apple silicon, and the app keeps two cores free.
export const MAX_THREADS = 8
export const SPARE_CORES = 2
