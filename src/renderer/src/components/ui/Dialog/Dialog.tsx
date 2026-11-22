import { ReactNode, RefObject, useEffect, useRef } from 'react'
import { IconButton } from '../IconButton'
import { cx } from '../cx'
import './Dialog.css'

interface Props {
  title: string
  /** Accessible name of the close button. */
  closeLabel: string
  onClose(): void
  children: ReactNode
  /** A field to start in, for a dialog that's there to be typed into. */
  initialFocus?: RefObject<HTMLElement | null>
  className?: string
}

/** A modal panel with a title and close button; Esc or the close button dismisses it. */
export function Dialog({
  title,
  closeLabel,
  onClose,
  children,
  initialFocus,
  className
}: Props): React.JSX.Element {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const el = dialog.current
    // showModal traps focus and closes on Escape. It would also focus the close button,
    // popping its tooltip the moment the dialog opens; starting on the dialog itself
    // avoids that, and Tab still reaches every control.
    if (el && !el.open) {
      el.showModal()
      ;(initialFocus?.current ?? el).focus()
    }
  }, [initialFocus])

  return (
    <dialog
      ref={dialog}
      className={cx('dialog', className)}
      aria-label={title}
      tabIndex={-1}
      onClose={onClose}
      // While a dialog is open its keys are its own: Space shouldn't start the song behind it.
      onKeyDown={(e) => e.stopPropagation()}
    >
      <header className="dialog-header">
        <h2>{title}</h2>
        <IconButton icon="close" label={closeLabel} onClick={onClose} />
      </header>
      {children}
    </dialog>
  )
}
