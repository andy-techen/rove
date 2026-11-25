import { CSSProperties } from 'react'
import { t } from '@shared/copy'
import type { Tone } from '../../audio/voice'

const SCALES = ['warmth', 'clarity', 'air'] as const
const PERCENT = 100

/**
 * Each tone measure as a dot between two plain words. Neither end is better, so the dot
 * and track carry no good or bad colour.
 */
export function ToneScales({ tone }: { tone: Tone }): React.JSX.Element {
  return (
    <section className="voice-card">
      <h3>{t('voice.tone')}</h3>
      <ul className="voice-tone">
        {SCALES.map((scale) => {
          const low = t(`voice.${scale}Low`)
          const high = t(`voice.${scale}High`)
          return (
            <li
              key={scale}
              aria-label={t('voice.toneScale', {
                name: t(`voice.${scale}`),
                percent: Math.round(tone[scale] * PERCENT),
                low,
                high
              })}
            >
              <span className="voice-tone-name" aria-hidden="true">
                {t(`voice.${scale}`)}
              </span>
              <span
                className="voice-tone-track"
                style={{ '--position': tone[scale] } as CSSProperties}
                aria-hidden="true"
              />
              <span className="voice-tone-ends" aria-hidden="true">
                <span>{low}</span>
                <span>{high}</span>
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
