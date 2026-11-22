import { t } from '@shared/copy'
import { Dialog } from '../ui/Dialog'
import { KeymapTable } from './KeymapTable'
import './HelpDialog.css'

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

export function HelpDialog({ onClose }: { onClose(): void }): React.JSX.Element {
  return (
    <Dialog
      title={t('help.title')}
      closeLabel={t('help.close')}
      onClose={onClose}
      className="help-dialog"
    >
      <p className="muted">{t('help.intro')}</p>
      <KeymapTable />
      <h3>{t('help.tipsTitle')}</h3>
      <ul className="help-tips">
        {TIPS.map((tip) => (
          <li key={tip}>{t(tip)}</li>
        ))}
      </ul>
    </Dialog>
  )
}
