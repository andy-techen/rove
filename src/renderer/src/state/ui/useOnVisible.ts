import { useCallback, useEffect, useRef } from 'react'

/**
 * A ref for an element that calls `onVisible` each time it scrolls into view, so a list
 * can load its next page as the singer nears the end.
 */
export function useOnVisible(onVisible: () => void): (el: Element | null) => void {
  const latest = useRef(onVisible)
  useEffect(() => {
    latest.current = onVisible
  })
  const observer = useRef<IntersectionObserver | null>(null)
  return useCallback((el: Element | null) => {
    observer.current?.disconnect()
    observer.current = null
    if (!el) return
    observer.current = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) latest.current()
    })
    observer.current.observe(el)
  }, [])
}
