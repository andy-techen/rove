import { t } from '@shared/copy'

const TIPS = [
  'help.tips.headphones',
  'help.tips.punchIn',
  'help.tips.edit',
  'help.tips.selectClips',
  'help.tips.selectTracks',
  'help.tips.moveTracks',
  'help.tips.sweetSpot',
  'help.tips.tuning',
  'help.tips.music',
  'help.tips.lyrics',
  'help.tips.chords'
] as const

/** What Rove is for, and tips for getting the most from it. */
export function HelpSection(): React.JSX.Element {
  return (
    <div className="help-section">
      <p className="muted">{t('help.intro')}</p>
      <h3>{t('help.tipsTitle')}</h3>
      <ul className="help-tips">
        {TIPS.map((tip) => (
          <li key={tip}>{t(tip)}</li>
        ))}
      </ul>
    </div>
  )
}
