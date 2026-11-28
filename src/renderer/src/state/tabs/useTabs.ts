import { useCallback, useEffect, useRef, useState } from 'react'
import { t } from '@shared/copy'
import type { ChosenProject } from '@shared/songs/project'
import { moveItem } from './tabOrder'

export interface Tab {
  id: string
  /** The song the tab opened with; the tab owns its state from then on. */
  initial: ChosenProject
}

export interface Tabs {
  tabs: Tab[]
  /** No song open: the welcome screen shows. */
  activeId: string | null
  /** Last session's songs have been reopened (or there were none to reopen). */
  restored: boolean
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
  const [restored, setRestored] = useState(false)
  // Only a restore that worked may overwrite last session's list.
  const [remembering, setRemembering] = useState(false)

  // Reopen last session's songs once. Someone with no songs yet goes straight into a
  // fresh one; anyone else who closed them all comes back to the welcome screen.
  const restoring = useRef(false)
  useEffect(() => {
    if (!enabled || restoring.current) return
    restoring.current = true
    void (async () => {
      try {
        const { songs, activeSong } = await window.api.restoreTabs()
        const firstTime = !songs.length && (await window.api.listSongs()).length === 0
        const opened = firstTime ? [tab(await window.api.createSong())] : songs.map(tab)
        setTabs(opened)
        const active = opened.find((item) => item.initial.dir === activeSong) ?? opened[0]
        setActiveId(active?.id ?? null)
        setRemembering(true)
      } catch {
        setError(t('app.openFailed'))
      } finally {
        setRestored(true)
      }
    })()
  }, [enabled])

  // Remember which songs are open, in order, for next launch, even when that's none.
  const dirs = tabs.map((item) => info[item.id]?.dir ?? item.initial.dir)
  const activeDir = activeId ? (info[activeId]?.dir ?? null) : null
  const dirsKey = JSON.stringify(dirs)
  useEffect(() => {
    if (!remembering) return
    void window.api.rememberTabs(JSON.parse(dirsKey), activeDir)
  }, [remembering, dirsKey, activeDir])

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
    // After a failed restore, a song opened by hand is the session to remember.
    setRemembering(true)
  }

  return {
    tabs,
    activeId,
    restored,
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
      const index = tabs.findIndex((item) => item.id === tabId)
      const remaining = tabs.filter((item) => item.id !== tabId)
      setTabs(remaining)
      if (tabId === activeId) setActiveId(remaining[Math.max(0, index - 1)]?.id ?? null)
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
