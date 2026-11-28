import { useEffect, useRef, useState } from 'react'
import { t } from '@shared/copy'
import { decodeAudio, getAudioContext } from '../../audio/engine/engine'
import type { ChosenProject } from '@shared/project'
import {
  Project,
  VocalPart,
  createProject,
  parseProject,
  withNewTrack,
  withTrackAudio
} from './project'
import { History, emptyHistory, pushHistory, redoHistory, undoHistory } from './history'

/** An audio file just added to the song, already decoded. */
export interface NewAudio {
  file: string
  audio: AudioBuffer
}

export interface OpenSong {
  dir: string
  data: Project
}

/** Where the song's project.json stands: waiting to save, saved (and when), or failed. */
export type SaveState =
  { status: 'saving' } | { status: 'saved'; at: number } | { status: 'failed' }

export interface Song {
  song: OpenSong | null
  /** Null until the song has been opened. */
  saveState: SaveState | null
  /** Decoded clip audio keyed by project-relative file path. */
  audio: Record<string, AudioBuffer>
  skipBacking: boolean
  busy: boolean
  error: string | null
  canUndo: boolean
  canRedo: boolean
  renameSong(name: string): Promise<void>
  addBackingTrack(): Promise<void>
  /** An empty backing track, for recording the music here. */
  addRecordedBacking(): Promise<void>
  addVocalTrack(part: VocalPart): Promise<void>
  recordWithoutMusic(): void
  /**
   * Applies an edit right away, remembers it for undo, and saves project.json
   * shortly after. Edits sharing a `coalesce` key in a row (one slider drag)
   * undo as a single step.
   */
  edit(data: Project, coalesce?: string): void
  /** Like edit, but writes project.json before resolving. Throws if the write fails. */
  saveProject(data: Project, newAudio?: NewAudio | NewAudio[]): Promise<void>
  undo(): void
  redo(): void
  /** Writes project.json now (File ▸ Save), even if nothing is waiting to be saved. */
  saveNow(): Promise<void>
}

async function loadAudio(dir: string, file: string): Promise<AudioBuffer> {
  return decodeAudio(await window.api.readAudio(dir, file))
}

const SAVE_DELAY_MS = 400

/** One open song (one tab): its project, decoded audio, and undo history. */
export function useSong(initial: ChosenProject): Song {
  const [song, setSong] = useState<OpenSong | null>(null)
  const [audio, setAudio] = useState<Record<string, AudioBuffer>>({})
  const [history, setHistory] = useState<History<Project>>(emptyHistory)
  const [skipBacking, setSkipBacking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<SaveState | null>(null)
  // Audio keeps loading after the user may have switched songs; results from an
  // earlier open are dropped. A token (not the folder path) survives renames.
  const openToken = useRef(0)
  // Callbacks read the latest song through this ref so rapid edits build on
  // each other instead of on a stale render.
  const current = useRef<OpenSong | null>(null)
  const pendingSave = useRef<{ timer: ReturnType<typeof setTimeout>; dir: string } | null>(null)

  const show = (next: OpenSong | null): void => {
    current.current = next
    setSong(next)
  }

  /** Every write of project.json goes through here, so the save indicator is always right. */
  const persist = async (dir: string, data: Project): Promise<void> => {
    setSaveState({ status: 'saving' })
    try {
      await window.api.writeManifest(dir, data)
      setSaveState({ status: 'saved', at: Date.now() })
    } catch (err) {
      setSaveState({ status: 'failed' })
      throw err
    }
  }

  const writeNow = async (dir: string, data: Project): Promise<void> => {
    if (pendingSave.current) clearTimeout(pendingSave.current.timer)
    pendingSave.current = null
    await persist(dir, data)
  }

  const scheduleSave = (dir: string): void => {
    if (pendingSave.current) clearTimeout(pendingSave.current.timer)
    setSaveState({ status: 'saving' })
    const timer = setTimeout(() => {
      pendingSave.current = null
      const latest = current.current
      if (!latest || latest.dir !== dir) return
      persist(dir, latest.data).catch(() => setError(t('song.saveFailed')))
    }, SAVE_DELAY_MS)
    pendingSave.current = { timer, dir }
  }

  // Don't lose a debounced save when switching songs or closing the window.
  const flushSave = async (): Promise<void> => {
    const latest = current.current
    if (pendingSave.current && latest) await writeNow(latest.dir, latest.data)
  }
  useEffect(() => {
    const onUnload = (): void => void flushSave()
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  })

  const load = async (chosen: ChosenProject): Promise<void> => {
    await flushSave()
    const data = chosen.manifest
      ? parseProject(chosen.manifest)
      : createProject(chosen.name, getAudioContext().sampleRate, chosen.artist, chosen.note)
    // Persist new songs right away.
    if (!chosen.manifest) {
      await persist(chosen.dir, data)
    } else {
      // Freshly opened from disk: everything on screen is already saved.
      setSaveState({ status: 'saved', at: Date.now() })
    }
    const { dir } = chosen
    const token = ++openToken.current
    show({ dir, data })
    setHistory(emptyHistory)
    setAudio({})
    setSkipBacking(false)

    for (const track of data.tracks) {
      for (const clip of track.clips) {
        loadAudio(dir, clip.file)
          .then((buffer) => {
            if (openToken.current !== token) return
            setAudio((prev) => ({ ...prev, [clip.file]: buffer }))
          })
          .catch(
            () =>
              openToken.current === token && setError(t('song.audioMissing', { name: track.name }))
          )
      }
    }
  }

  const run = async (action: () => Promise<void>, failure: string): Promise<void> => {
    setError(null)
    setBusy(true)
    try {
      await action()
    } catch (err) {
      setError(
        err instanceof Error && !err.message.includes('remote method') ? err.message : failure
      )
    } finally {
      setBusy(false)
    }
  }

  const edit = (data: Project, coalesce?: string): void => {
    const open = current.current
    if (!open) return
    setHistory((h) => pushHistory(h, open.data, coalesce))
    show({ dir: open.dir, data })
    scheduleSave(open.dir)
  }

  const saveProject = async (data: Project, newAudio?: NewAudio | NewAudio[]): Promise<void> => {
    const open = current.current
    if (!open) return
    await writeNow(open.dir, data)
    setHistory((h) => pushHistory(h, open.data))
    show({ dir: open.dir, data })
    const added = newAudio ? [newAudio].flat() : []
    if (added.length) {
      setAudio((prev) => ({ ...prev, ...Object.fromEntries(added.map((a) => [a.file, a.audio])) }))
    }
  }

  const travel = (step: typeof undoHistory): void => {
    const open = current.current
    if (!open) return
    const moved = step(history, open.data)
    if (!moved) return
    setHistory(moved.history)
    show({ dir: open.dir, data: moved.value })
    scheduleSave(open.dir)
  }

  const started = useRef(false)
  useEffect(() => {
    if (started.current) return
    started.current = true
    void run(() => load(initial), t('song.openFailed'))
  })

  // Closing the tab mustn't drop the last few edits still waiting to be saved.
  const flushRef = useRef(flushSave)
  useEffect(() => {
    flushRef.current = flushSave
  })
  useEffect(() => () => void flushRef.current(), [])

  return {
    song,
    saveState,
    saveNow: async () => {
      const open = current.current
      if (!open) return
      try {
        await writeNow(open.dir, open.data)
      } catch {
        setError(t('song.saveFailed'))
      }
    },
    audio,
    skipBacking,
    busy,
    error,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    edit,
    saveProject,
    undo: () => travel(undoHistory),
    redo: () => travel(redoHistory),
    // Renames aren't undoable: they can move the song folder on disk.
    renameSong: (name) =>
      run(async () => {
        const open = current.current
        const trimmed = name.trim()
        if (!open || !trimmed || trimmed === open.data.name) return
        await flushSave()
        const dir = await window.api.renameSong(open.dir, trimmed)
        const data = { ...open.data, name: trimmed }
        await persist(dir, data)
        show({ dir, data })
      }, t('song.renameFailed')),
    addBackingTrack: () =>
      run(async () => {
        const open = current.current
        if (!open) return
        const imported = await window.api.importBackingTrack(open.dir)
        if (!imported) return
        const buffer = await loadAudio(open.dir, imported.file)
        const { project, track } = withNewTrack(open.data, 'backing', {
          sourceName: imported.name
        })
        await saveProject(withTrackAudio(project, track.id, imported.file, buffer.duration), {
          file: imported.file,
          audio: buffer
        })
      }, t('song.backingFailed')),
    addRecordedBacking: () =>
      run(async () => {
        const open = current.current
        if (open) await saveProject(withNewTrack(open.data, 'backing').project)
      }, t('song.backingFailed')),
    addVocalTrack: (part) =>
      run(async () => {
        const open = current.current
        if (open) await saveProject(withNewTrack(open.data, 'vocal', { part }).project)
      }, t('song.addVocalFailed')),
    recordWithoutMusic: () => setSkipBacking(true)
  }
}
