import { useRef, useState } from 'react'
import { LyricsResult } from '@shared/lyrics'

export type LyricsSearchState =
  | { status: 'idle' }
  | { status: 'searching' }
  | { status: 'done'; results: LyricsResult[] }
  | { status: 'failed' }

export interface LyricsSearch {
  state: LyricsSearchState
  search(query: string): Promise<void>
}

/** Searches online for lyrics. Only the latest search's answer is shown. */
export function useLyricsSearch(): LyricsSearch {
  const [state, setState] = useState<LyricsSearchState>({ status: 'idle' })
  const latest = useRef(0)
  return {
    state,
    search: async (query) => {
      const request = ++latest.current
      setState({ status: 'searching' })
      try {
        const results = await window.api.searchLyrics(query)
        if (request === latest.current) setState({ status: 'done', results })
      } catch {
        if (request === latest.current) setState({ status: 'failed' })
      }
    }
  }
}
