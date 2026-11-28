import { TASTE_CONTROLS, TasteExample } from '@shared/polishTaste'
import { Taste, ruledPolish } from './autoPolish'
import { clamp } from '../dsp/units'

/** The furthest the singer's taste leans a control from what the rules say. */
export const MAX_LEAN = 0.15
// Each song back counts this much less than the one after it, so a new mic or room
// takes over within a dozen or so songs.
const DECAY = 0.85
// How many songs' worth of "the rules were right" every lean starts from, so one song
// can't swing the next much on its own.
const PRIOR_SONGS = 2
// Leans smaller than this are left out: under a step on the knob, nobody would hear it.
const MIN_LEAN = 0.01
const STEPS = 100

// More noise reduction raises the gate, which on another take could cut soft singing;
// only less is learned.
const MOST: Partial<Record<keyof Taste, number>> = { cleanup: 0 }

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
