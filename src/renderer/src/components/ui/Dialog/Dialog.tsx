import { CSSProperties, ReactNode, RefObject, useEffect, useRef } from 'react'
import { IconButton } from '../IconButton'
import { cx } from '../cx'
import { dialogSizeStyle, useDialogSize } from '../../../state/ui/dialogSize'
import './Dialog.css'

interface Props {
  title: string
  /** Accessible name of the close button. */
  closeLabel: string
  /**
   * Every dialog can be dragged bigger or smaller by its corner; the size it was dragged
   * to comes back next time under this name.
   */
  sizeKey: string
  onClose(): void
  children: ReactNode
  /** A field to start in, for a dialog that's there to be typed into. */
  initialFocus?: RefObject<HTMLElement | null>
  className?: string
  /** Lays the content out as a column, so a part of it (a list, a picture) can grow with the dialog. */
  fill?: boolean
  /** Geometry worked out at run time, as CSS custom properties. */
  style?: CSSProperties
  /** The dialog element, for a caller that measures it. */
  dialogRef?: RefObject<HTMLDialogElement | null>
}

/** A modal panel with a title and close button; Esc or the close button dismisses it. */
export function Dialog({
  title,
  closeLabel,
  sizeKey,
  onClose,
  children,
  initialFocus,
  className,
  fill,
  style,
  dialogRef
}: Props): React.JSX.Element {
  const dialog = useRef<HTMLDialogElement>(null)
  const size = useDialogSize(dialog, sizeKey)
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
      ref={(el) => {
        dialog.current = el
        if (dialogRef) dialogRef.current = el
      }}
      className={cx('dialog', fill && 'dialog-fill', className)}
      style={{ ...dialogSizeStyle(size, 'dialog'), ...style }}
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
