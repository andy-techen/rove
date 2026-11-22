import { useEffect, useRef, useState } from 'react'
import { t } from '@shared/copy'
import { encodeWav } from '../../audio/encode/wav'
import { removeVocals } from '../../audio/separation/removeVocals'
import { vocalsRemoved, withVocalsBack, withoutVocals } from '../song/project'
import type { NewAudio, Song } from '../song/useSong'

/** Whether a backing track plays its song as it is, is having the vocals removed, or not. */
export type VocalsState =
  { state: 'with' } | { state: 'removing'; progress: number } | { state: 'removed' }

export interface VocalRemoval {
  vocals: VocalsState
  error: string | null
  remove(): void
  cancel(): void
  putBack(): void
}

// The model (13 MB) is read once per session, then kept for every song.
let model: Promise<Uint8Array> | null = null
const separationModel = (): Promise<Uint8Array> =>
  (model ??= window.api.readSeparationModel().catch((error: unknown) => {
    model = null
    throw error
  }))

const isStop = (error: unknown): boolean =>
  error instanceof DOMException && error.name === 'AbortError'

/**
 * Turns a backing track's songs into instrumentals: each new file is written beside its
 * song (which stays as it is), and the clips switch to it until the vocals are put back.
 */
export function useVocalRemoval(song: Song, trackId: string | null): VocalRemoval {
  const [running, setRunning] = useState<{ trackId: string; progress: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const stopper = useRef<AbortController | null>(null)
  // The song as it is when the work finishes, minutes later, not as it was when it began.
  const latest = useRef(song)
  useEffect(() => {
    latest.current = song
  })
  useEffect(() => () => stopper.current?.abort(), [])

  const track = song.song?.data.tracks.find((candidate) => candidate.id === trackId)
  const vocals: VocalsState =
    running && running.trackId === trackId
      ? { state: 'removing', progress: running.progress }
      : track && vocalsRemoved(track)
        ? { state: 'removed' }
        : { state: 'with' }

  const remove = async (id: string): Promise<void> => {
    const open = latest.current.song
    const target = open?.data.tracks.find((candidate) => candidate.id === id)
    if (!open || !target || stopper.current) return
    const files = [...new Set(target.clips.filter((c) => !c.withVocals).map((c) => c.file))]
    const controller = new AbortController()
    stopper.current = controller
    setError(null)
    setRunning({ trackId: id, progress: 0 })
    try {
      const bytes = await separationModel()
      const instrumentals: Record<string, string> = {}
      const added: NewAudio[] = []
      for (const [index, file] of files.entries()) {
        const songAudio = latest.current.audio[file]
        if (!songAudio) continue
        const channels = await removeVocals(songAudio, bytes, {
          signal: controller.signal,
          onProgress: (fraction) =>
            setRunning({ trackId: id, progress: (index + fraction) / files.length })
        })
        const audio = new AudioBuffer({
          length: channels[0].length,
          numberOfChannels: channels.length,
          sampleRate: songAudio.sampleRate
        })
        channels.forEach((channel, c) => audio.copyToChannel(channel, c))
        const wav = encodeWav(channels, songAudio.sampleRate)
        const saved = await window.api.saveInstrumental(open.dir, file, wav)
        instrumentals[file] = saved
        added.push({ file: saved, audio })
      }
      const now = latest.current.song
      if (now && added.length) {
        await latest.current.saveProject(withoutVocals(now.data, id, instrumentals), added)
      }
    } catch (failure) {
      if (!isStop(failure)) setError(t('music.removeVocalsFailed'))
    } finally {
      stopper.current = null
      setRunning(null)
    }
  }

  return {
    vocals,
    error: trackId && running?.trackId !== trackId ? error : null,
    remove: () => {
      if (trackId) void remove(trackId)
    },
    cancel: () => stopper.current?.abort(),
    putBack: () => {
      const data = song.song?.data
      if (data && trackId) song.edit(withVocalsBack(data, trackId))
    }
  }
}
