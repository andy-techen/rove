import { useEffect, useRef, useState } from 'react'
import { MenuState, MenuTarget, contextMenu } from '../../state/commands/contextMenu'

/**
 * Shows the right-click menu. A right-click picks what it's on first; the menu waits for
 * that render, so it shows what can be done to the new selection. `stateNow` is read
 * then, from the latest render; null means there's no song to act on.
 */
export function useContextMenu(stateNow: () => MenuState | null): (target: MenuTarget) => void {
  const menuFor = useRef<MenuTarget | null>(null)
  const [request, setRequest] = useState(0)
  const show = useRef<() => void>(() => {})
  useEffect(() => {
    show.current = () => {
      const target = menuFor.current
      menuFor.current = null
      const state = target && stateNow()
      if (!target || !state) return
      void window.api.showContextMenu(contextMenu(target, state))
    }
  })
  useEffect(() => show.current(), [request])
  return (target) => {
    menuFor.current = target
    setRequest((n) => n + 1)
  }
}
