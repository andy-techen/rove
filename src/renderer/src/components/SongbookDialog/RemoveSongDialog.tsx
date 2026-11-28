import { t } from '@shared/copy'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'

interface Props {
  name: string
  onRemove(): void
  onCancel(): void
}

/** Removing a song takes its recordings with it, so say so plainly before it happens. */
export function RemoveSongDialog({ name, onRemove, onCancel }: Props): React.JSX.Element {
  return (
    <Dialog
      title={t('songbook.removeTitle', { name })}
      closeLabel={t('songbook.cancel')}
      onClose={onCancel}
      sizeKey="removeSong"
      className="remove-song"
    >
      <p className="remove-song-warning">{t('songbook.removeWarning')}</p>
      <div className="remove-song-actions">
        <Button variant="quiet" onClick={onCancel}>
          {t('songbook.cancel')}
        </Button>
        <Button className="remove-song-confirm" onClick={onRemove}>
          {t('songbook.remove')}
        </Button>
      </div>
    </Dialog>
  )
}
