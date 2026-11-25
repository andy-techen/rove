import { CSSProperties, RefObject, useEffect, useState } from 'react'
import { recall, remember } from './sidePanels'

export interface DialogSize {
  width: number | null
  height: number | null
}

/**
 * The size the singer dragged a dialog to, kept for next time under `name`
 * (rove.<name>.width and .height). Null until they've
 * resized it, so it opens at its default size. The browser writes an inline width and
 * height only once the dialog has been dragged, which is how a drag is told apart from
 * the window resizing round it.
 */
export function useDialogSize(dialog: RefObject<HTMLElement | null>, name: string): DialogSize {
  const widthKey = `rove.${name}.width`
  const heightKey = `rove.${name}.height`
  const [size] = useState<DialogSize>(() => ({
    width: recall(widthKey),
    height: recall(heightKey)
  }))
  useEffect(() => {
    const el = dialog.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      if (!el.style.width && !el.style.height) return
      remember(widthKey, el.offsetWidth)
      remember(heightKey, el.offsetHeight)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [dialog, widthKey, heightKey])
  return size
}

/** A remembered size as the CSS custom properties a resizable dialog reads. */
export function dialogSizeStyle(size: DialogSize, prefix: string): CSSProperties {
  return {
    ...(size.width && { [`--${prefix}-width`]: `${size.width}px` }),
    ...(size.height && { [`--${prefix}-height`]: `${size.height}px` })
  } as CSSProperties
}
