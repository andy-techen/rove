import { t } from '@shared/copy'
import { Button } from '../Button'
import { Dialog } from '../Dialog'
import { cx } from '../cx'
import './ConfirmDialog.css'

interface Props {
  title: string
  /** What happens if they go ahead, said plainly. */
  message: string
  confirmLabel: string
  /** Red for something that can't be taken back (removing a song). */
  danger?: boolean
  /** Where the dialog's size is remembered. */
  sizeKey: string
  onConfirm(): void
  onCancel(): void
}

/** Asks before a step that's hard to undo; Cancel, Esc and the close button all back out. */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  danger = false,
  sizeKey,
  onConfirm,
  onCancel
}: Props): React.JSX.Element {
  return (
    <Dialog
      title={title}
      closeLabel={t('confirm.cancel')}
      onClose={onCancel}
      sizeKey={sizeKey}
      className="confirm-dialog"
    >
      <p className="confirm-dialog-message">{message}</p>
      <div className="confirm-dialog-actions">
        <Button variant="quiet" onClick={onCancel}>
          {t('confirm.cancel')}
        </Button>
        <Button className={cx(danger && 'confirm-dialog-danger')} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  )
}
