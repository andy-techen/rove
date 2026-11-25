import { CSSProperties } from 'react'
import { t } from '@shared/copy'
import type { Tone } from '../../audio/voice'
import { TONE_SCALES, toneHeadline, toneLeans } from '../../state/voice/toneWords'
import { HelpTip } from '../ui/HelpTip'
import { cx } from '../ui/cx'

/** What the three scales mean, as a short list, for the help tip by the title. */
function ToneHelp(): React.JSX.Element {
  return (
    <div className="voice-help">
      <ul>
        {TONE_SCALES.map((scale) => (
          <li key={scale}>
            <span>
              <strong>
                {t('voice.tone.pair', {
                  low: t(`voice.tone.${scale}.low`),
                  high: t(`voice.tone.${scale}.high`).toLowerCase()
                })}
              </strong>
              : {t(`voice.tone.${scale}.about`)}
            </span>
          </li>
        ))}
      </ul>
      <p>{t('voice.tone.helpNote')}</p>
    </div>
  )
}

/**
 * How the voice sounds: a few words up top, then each scale as a dot between two words
 * that are both good, with a tick at the middle. The word the voice leans to stands
 * out; one help tip by the title explains all three.
 */
export function ToneScales({ tone }: { tone: Tone }): React.JSX.Element {
  const leans = toneLeans(tone)
  return (
    <section className="voice-card">
      <div className="voice-title">
        <h3>{t('voice.tone.title')}</h3>
        <HelpTip text={t('voice.tone.help')} content={<ToneHelp />} />
      </div>
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
          return (
            <li key={scale} aria-label={t('voice.tone.row', { low, high, word })}>
              <span className={cx('voice-tone-end', lean === 'low' && 'lean')} aria-hidden="true">
                {low}
              </span>
              <span
                className="voice-tone-track"
                style={{ '--position': tone[scale] } as CSSProperties}
                aria-hidden="true"
              />
              <span className={cx('voice-tone-end', lean === 'high' && 'lean')} aria-hidden="true">
                {high}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
