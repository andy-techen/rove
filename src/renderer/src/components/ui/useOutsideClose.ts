import { useEffect } from 'react'

/** Close `open` state on Escape or a click outside the wrapper. */
export function useOutsideClose(
  wrapper: React.RefObject<HTMLElement | null>,
  open: boolean,
  close: () => void
): void {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close()
    }
    const onClick = (e: MouseEvent): void => {
      if (!wrapper.current?.contains(e.target as Node)) close()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [open, close, wrapper])
}
