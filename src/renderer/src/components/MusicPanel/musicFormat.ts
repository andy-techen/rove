import { t } from '@shared/copy'
import { MUSIC_SEMITONES_MAX } from '../../state/project'
import { parseTypedNumber } from '../ui/NumberField'

const PERCENT = 100

export const speedPercent = (speed: number): number => Math.round(speed * PERCENT)

/** The tempo as it plays now, to the nearest beat per minute. */
export const tempoAt = (bpm: number, speed: number): number => Math.round(bpm * speed)

/** Reads a typed tempo (or percentage, when the tempo is unknown) as a speed. */
export function parseSpeed(text: string, bpm: number | null): number | null {
  const n = parseTypedNumber(text)
  if (n === null || n <= 0) return null
  return bpm ? Math.round((n / bpm) * PERCENT) / PERCENT : n / PERCENT
}

/** "+2", "−1", "0". */
export function formatSigned(n: number): string {
  if (n > 0) return t('music.plus', { n })
  if (n < 0) return t('music.minus', { n: -n })
  return String(n)
}

/** A typed key change in whole semitones, kept within the knob's range. */
export function parseSemitones(text: string): number | null {
  const n = parseTypedNumber(text)
  if (n === null) return null
  return Math.max(-MUSIC_SEMITONES_MAX, Math.min(MUSIC_SEMITONES_MAX, Math.round(n)))
}
