/**
 * A number as people type it: a typographic minus, a decimal comma and a unit after
 * it are all fine ("−3", "2,5", "120 BPM"). Null when there's no number.
 */
export function parseTypedNumber(text: string): number | null {
  const n = Number.parseFloat(text.trim().replace('−', '-').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}
