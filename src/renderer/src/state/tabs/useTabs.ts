import { useCallback, useEffect, useRef, useState } from 'react'
import { t } from '@shared/copy'
import type { ChosenProject } from '@shared/project'
import { moveItem } from './tabOrder'

export interface Tab {
  id: string
  /** The song the tab opened with; the tab owns its state from then on. */
  initial: ChosenProject
}

export interface Tabs {
  tabs: Tab[]
  activeId: string | null
  /** Current name and folder of each tab's song, keyed by tab id. */
  info: Record<string, { name: string; dir: string }>
  error: string | null
  setInfo(tabId: string, info: { name: string; dir: string }): void
  switchTo(tabId: string): void
  /** Moves a tab to a new place in the bar (remembered for next launch). */
  move(tabId: string, toIndex: number): void
  close(tabId: string): void
  newSong(name?: string, artist?: string, note?: string): Promise<void>
  open(): Promise<void>
  /** Opens a song from the Songbook by its folder name. */
  openByName(folder: string): Promise<void>
  /** Asks for a .rove project file and opens it as a new song. */
  importSongFile(): Promise<void>
}

const tab = (initial: ChosenProject): Tab => ({ id: crypto.randomUUID(), initial })

export function useTabs(enabled: boolean): Tabs {
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [info, setInfoMap] = useState<Record<string, { name: string; dir: string }>>({})
  const [error, setError] = useState<string | null>(null)

  // Reopen last session's songs once, or start a fresh one.
  const restored = useRef(false)
  useEffect(() => {
    if (!enabled || restored.current) return
    restored.current = true
    void (async () => {
      try {
        const { songs, activeSong } = await window.api.restoreTabs()
        const opened = songs.length ? songs.map(tab) : [tab(await window.api.createSong())]
        setTabs(opened)
        const active = opened.find((item) => item.initial.dir === activeSong) ?? opened[0]
        setActiveId(active.id)
      } catch {
        setError(t('app.openFailed'))
      }
    })()
  }, [enabled])

  // Remember which songs are open, in order, for next launch.
  const dirs = tabs.map((item) => info[item.id]?.dir ?? item.initial.dir)
  const activeDir = activeId ? (info[activeId]?.dir ?? null) : null
  const dirsKey = dirs.join('\n')
  useEffect(() => {
    if (!dirsKey) return
    void window.api.rememberTabs(dirsKey.split('\n'), activeDir)
  }, [dirsKey, activeDir])

  const setInfo = useCallback((tabId: string, next: { name: string; dir: string }) => {
    setInfoMap((prev) =>
      prev[tabId]?.name === next.name && prev[tabId]?.dir === next.dir
        ? prev
        : { ...prev, [tabId]: next }
    )
  }, [])

  const add = (initial: ChosenProject): void => {
    // A song that's already open just comes to the front.
    const existing = tabs.find((item) => (info[item.id]?.dir ?? item.initial.dir) === initial.dir)
    if (existing) return setActiveId(existing.id)
    const next = tab(initial)
    setTabs((prev) => [...prev, next])
    setActiveId(next.id)
  }

  return {
    tabs,
    activeId,
    info,
    error,
    setInfo,
    switchTo: setActiveId,
    move: (tabId, toIndex) =>
      setTabs((prev) =>
        moveItem(
          prev,
          prev.findIndex((item) => item.id === tabId),
          toIndex
        )
      ),
    close: (tabId) => {
      if (tabs.length <= 1) return
      const index = tabs.findIndex((item) => item.id === tabId)
      const remaining = tabs.filter((item) => item.id !== tabId)
      setTabs(remaining)
      if (tabId === activeId) setActiveId(remaining[Math.max(0, index - 1)].id)
    },
    newSong: async (name, artist, note) => {
      try {
        add(await window.api.createSong(name, artist, note))
      } catch {
        setError(t('app.newSongFailed'))
      }
    },
    open: async () => {
      try {
        const chosen = await window.api.chooseProjectFolder()
        if (chosen) add(chosen)
      } catch {
        setError(t('app.openFolderFailed'))
      }
    },
    openByName: async (folder) => {
      try {
        add(await window.api.openSongbookSong(folder))
      } catch {
        setError(t('app.openFolderFailed'))
      }
    },
    importSongFile: async () => {
      try {
        const imported = await window.api.importSongFile()
        if (imported) add(imported)
      } catch {
        setError(t('songFile.importFailed'))
      }
    }
  }
}
