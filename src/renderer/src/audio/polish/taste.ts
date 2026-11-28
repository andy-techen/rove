import { TASTE_CONTROLS, TasteExample } from '@shared/preferences/polishTaste'
import { Taste, ruledPolish } from './autoPolish'
import { clamp } from '../dsp/units'
import { STEPS, MAX_LEAN, DECAY, PRIOR_SONGS, MIN_LEAN, MOST } from './constants'

/**
 * How the singer likes Polish, learned from where they left the knobs on tracks auto
 * polish set (newest first). Each control leans by the recency-weighted average of how
 * far they moved it from what today's rules say for that take, pulled toward no lean
 * while there are few songs, and capped. Measuring from the rules, never from an earlier
 * lean, means keeping what it learned confirms it rather than growing it.
 */
export function learnTaste(examples: TasteExample[], except?: string): Taste {
  const heard = examples.filter((e) => e.trackId !== except)
  const sums = Object.fromEntries(TASTE_CONTROLS.map((key) => [key, 0]))
  let weight = 0
  heard.forEach((example, i) => {
    const w = DECAY ** i
    const ruled = ruledPolish(example.reading, example.part)
    for (const key of TASTE_CONTROLS) sums[key] += w * (example.kept[key] - ruled[key])
    weight += w
  })
  return Object.fromEntries(
    TASTE_CONTROLS.flatMap((key) => {
      const mean = sums[key] / (weight + PRIOR_SONGS)
      const lean = clamp(mean, -MAX_LEAN, MOST[key] ?? MAX_LEAN)
      const stepped = Math.round(lean * STEPS) / STEPS
      return Math.abs(stepped) >= MIN_LEAN ? [[key, stepped]] : []
    })
  )
}
