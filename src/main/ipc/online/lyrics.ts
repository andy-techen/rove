import { app, ipcMain, net } from 'electron'
import { t } from '@shared/copy'
import { LYRICS_CHANNELS, LyricsResult, parseSearchResults } from '@shared/online/lyrics'
import { LYRICS_QUERY_MAX } from '@shared/online/constants'
import { TIMEOUT_MS } from './constants'

const SEARCH_URL = 'https://lrclib.net/api/search'

/**
 * Lyrics searches run here rather than in the window, so the renderer never talks to
 * the internet itself. Only the search words leave the machine.
 */
export function registerLyricsIpc(): void {
  ipcMain.handle(LYRICS_CHANNELS.search, async (_e, query: unknown): Promise<LyricsResult[]> => {
    const words = typeof query === 'string' ? query.trim() : ''
    if (!words || words.length > LYRICS_QUERY_MAX) return []
    const url = `${SEARCH_URL}?${new URLSearchParams({ q: words })}`
    try {
      const response = await net.fetch(url, {
        // LRCLIB asks clients to name themselves.
        headers: { 'User-Agent': `Rove/${app.getVersion()}` },
        signal: AbortSignal.timeout(TIMEOUT_MS)
      })
      if (!response.ok) throw new Error(String(response.status))
      return parseSearchResults(await response.json())
    } catch {
      throw new Error(t('lyrics.searchFailed'))
    }
  })
}
