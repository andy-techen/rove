import { useState } from 'react'
import { decodeAudio, getAudioContext } from '../audio/engine'
import { Project, createProject, parseProject, withBackingTrack } from './project'

export interface OpenSong {
  dir: string
  data: Project
}

export interface Song {
  song: OpenSong | null
  backing: AudioBuffer | null
  skipBacking: boolean
  busy: boolean
  error: string | null
  chooseFolder(): Promise<void>
  addBackingTrack(): Promise<void>
  recordWithoutMusic(): void
  updateProject(data: Project): void
}

async function loadAudio(dir: string, file: string): Promise<AudioBuffer> {
  return decodeAudio(await window.api.readAudio(dir, file))
}

// Lives above the screens so going back to the mic check keeps the open song.
export function useSong(): Song {
  const [song, setSong] = useState<OpenSong | null>(null)
  const [backing, setBacking] = useState<AudioBuffer | null>(null)
  const [skipBacking, setSkipBacking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const chooseFolder = async (): Promise<void> => {
    setError(null)
    setBusy(true)
    try {
      const chosen = await window.api.chooseProjectFolder()
      if (!chosen) return
      const data = chosen.manifest
        ? parseProject(chosen.manifest)
        : createProject(chosen.name, getAudioContext().sampleRate)
      if (!chosen.manifest) await window.api.writeManifest(chosen.dir, data)
      setSong({ dir: chosen.dir, data })
      setSkipBacking(false)
      setBacking(null)
      if (data.backingTrack) {
        try {
          setBacking(await loadAudio(chosen.dir, data.backingTrack.file))
        } catch {
          setError(`Couldn't load the backing track "${data.backingTrack.name}". Add it again.`)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't open that folder.")
    } finally {
      setBusy(false)
    }
  }

  const addBackingTrack = async (): Promise<void> => {
    if (!song) return
    setError(null)
    setBusy(true)
    try {
      const imported = await window.api.importBackingTrack(song.dir)
      if (!imported) return
      const buffer = await loadAudio(song.dir, imported.file)
      const data = withBackingTrack(song.data, imported.file, imported.name)
      await window.api.writeManifest(song.dir, data)
      setSong({ dir: song.dir, data })
      setBacking(buffer)
    } catch {
      setError("Couldn't use that file as a backing track. Try an MP3, WAV or M4A.")
    } finally {
      setBusy(false)
    }
  }

  return {
    song,
    backing,
    skipBacking,
    busy,
    error,
    chooseFolder,
    addBackingTrack,
    recordWithoutMusic: () => setSkipBacking(true),
    updateProject: (data) => setSong((s) => s && { ...s, data })
  }
}
