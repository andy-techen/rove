import { t } from '@shared/copy'
import type { Tone } from '../../audio/voice'

export type Lean = 'low' | 'balanced' | 'high'
export type ToneLeans = Record<keyof Tone, Lean>

export const TONE_SCALES = ['body', 'brightness', 'air'] as const

// Within this of the middle, a voice is balanced on that scale rather than leaning.
const BALANCED_WITHIN = 0.15
const MIDDLE = 0.5

/** Which end of each scale the voice leans to. Both ends are good, just different. */
export function toneLeans(tone: Tone): ToneLeans {
  const lean = (v: number): Lean =>
    v < MIDDLE - BALANCED_WITHIN ? 'low' : v > MIDDLE + BALANCED_WITHIN ? 'high' : 'balanced'
  return { body: lean(tone.body), brightness: lean(tone.brightness), air: lean(tone.air) }
}

/** The voice in a few words: "Rich and mellow", "Bright, light and airy", "Balanced". */
export function toneHeadline(leans: ToneLeans): string {
  const words = TONE_SCALES.filter((s) => leans[s] !== 'balanced').map((s, i) => {
    const word = t(`voice.tone.${s}.${leans[s] as 'low' | 'high'}`)
    return i === 0 ? word : word.toLowerCase()
  })
  const [first, second, third] = words
  if (third) return t('voice.toneHeadline.three', { first, second, third })
  if (second) return t('voice.toneHeadline.two', { first, second })
  return first ?? t('voice.tone.balanced')
}
