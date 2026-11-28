// Decibel conversions. 20·log10 because these are amplitude (not power) ratios.
const DB_PER_DECADE = 20

export const dbToGain = (db: number): number => 10 ** (db / DB_PER_DECADE)

export const gainToDb = (gain: number): number =>
  gain > 0 ? DB_PER_DECADE * Math.log10(gain) : -Infinity

export const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value))
