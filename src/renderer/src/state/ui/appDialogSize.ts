import { RefObject, useEffect, useState } from 'react'
import { recall, remember } from './sidePanels'

const WIDTH_KEY = 'rove.appDialog.width'
const HEIGHT_KEY = 'rove.appDialog.height'

export interface DialogSize {
  width: number | null
  height: number | null
}

/**
 * The size the singer dragged the app dialog to, kept for next time. Null until they've
 * resized it, so it opens at its default size. The browser writes an inline width and
 * height only once the dialog has been dragged, which is how a drag is told apart from
 * the window resizing round it.
 */
export function useAppDialogSize(dialog: RefObject<HTMLElement | null>): DialogSize {
  const [size] = useState<DialogSize>(() => ({
    width: recall(WIDTH_KEY),
    height: recall(HEIGHT_KEY)
  }))
  useEffect(() => {
    const el = dialog.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      if (!el.style.width && !el.style.height) return
      remember(WIDTH_KEY, el.offsetWidth)
      remember(HEIGHT_KEY, el.offsetHeight)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [dialog])
  return size
}
