import { useEffect, useState } from 'react'

/** Whether the window is full screen, as reported by the main process. */
export function useFullScreen(): boolean {
  const [fullScreen, setFullScreen] = useState(false)
  useEffect(() => window.api.onFullScreen(setFullScreen), [])
  return fullScreen
}
