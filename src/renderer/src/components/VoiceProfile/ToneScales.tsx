import { CSSProperties } from 'react'
import { t } from '@shared/copy'
import type { Tone } from '../../audio/voice'
import { TONE_SCALES, toneHeadline, toneLeans } from '../../state/voice/toneWords'
import { Tooltip } from '../ui/Tooltip'

/**
 * How the voice sounds: a few words up top, then each scale as a dot between two words
 * that are both good, so no end reads as a fault. The scale's name is a pill that
 * explains it on hover or focus.
 */
export function ToneScales({ tone }: { tone: Tone }): React.JSX.Element {
  const leans = toneLeans(tone)
  return (
    <section className="voice-card">
      <h3>{t('voice.tone.title')}</h3>
      <p className="voice-subtitle">{t('voice.tone.subtitle')}</p>
      <p className="voice-headline">
        <strong>{toneHeadline(leans)}</strong>
      </p>
      <ul className="voice-tone">
        {TONE_SCALES.map((scale) => {
          const low = t(`voice.tone.${scale}.low`)
          const high = t(`voice.tone.${scale}.high`)
          const lean = leans[scale]
          const word = lean === 'balanced' ? t('voice.tone.balanced') : lean === 'low' ? low : high
          const help = t(`voice.tone.${scale}.help`)
          return (
            <li key={scale}>
              <Tooltip text={help}>
                <button
                  type="button"
                  className="voice-pill"
                  aria-label={t('voice.tone.scale', {
                    name: t(`voice.tone.${scale}.name`),
                    word,
                    help
                  })}
                >
                  {t(`voice.tone.${scale}.name`)}
                </button>
              </Tooltip>
              <span className="voice-tone-end" aria-hidden="true">
                {low}
              </span>
              <span
                className="voice-tone-track"
                style={{ '--position': tone[scale] } as CSSProperties}
                aria-hidden="true"
              />
              <span className="voice-tone-end" aria-hidden="true">
                {high}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
