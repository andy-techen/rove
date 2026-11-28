import { useEffect, useState, useSyncExternalStore } from 'react'
import type { TextSize, Theme } from '@shared/preferences/appearance'
import { DEFAULT_SCHEME } from './constants'

export type ColorScheme = 'light' | 'dark'

const DARK_QUERY = '(prefers-color-scheme: dark)'

const query = (): MediaQueryList | null => window.matchMedia?.(DARK_QUERY) ?? null

function subscribe(onChange: () => void): () => void {
  const list = query()
  list?.addEventListener('change', onChange)
  return () => list?.removeEventListener('change', onChange)
}

const snapshot = (): ColorScheme => {
  const list = query()
  if (!list) return DEFAULT_SCHEME
  return list.matches ? 'dark' : 'light'
}

/** The colours showing right now, following the system or the app's own theme choice. */
export const useColorScheme = (): ColorScheme => useSyncExternalStore(subscribe, snapshot)

/** The chosen theme (light, dark or following the system), and a way to change it. */
export function useTheme(): { theme: Theme; setTheme(theme: Theme): void } {
  const [theme, setChoice] = useState<Theme>('system')
  useEffect(() => window.api.onTheme(setChoice), [])
  return { theme, setTheme: (next) => void window.api.setTheme(next) }
}

/** The chosen text size, and a way to change it. */
export function useTextSize(): { textSize: TextSize; setTextSize(size: TextSize): void } {
  const [textSize, setChoice] = useState<TextSize>('medium')
  useEffect(() => window.api.onTextSize(setChoice), [])
  return { textSize, setTextSize: (next) => void window.api.setTextSize(next) }
}
