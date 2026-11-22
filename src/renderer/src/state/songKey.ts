import { useEffect, useState } from 'react'
import { SongKey, detectKey, transposeKey } from '../audio/key'
import { Project, musicOf, tracksOf } from './project'

const heard = new WeakMap<AudioBuffer, Promise<SongKey | null>>()

/** The music's key as recorded, heard once per recording and remembered. */
function keyOfRecording(buffer: AudioBuffer): Promise<SongKey | null> {
  let key = heard.get(buffer)
  if (!key) {
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, ch) =>
      buffer.getChannelData(ch)
    )
    key = detectKey([{ channels, sampleRate: buffer.sampleRate }]).catch(() => null)
    heard.set(buffer, key)
  }
  return key
}

/** The first loaded recording of the backing music, if any. */
function musicRecording(
  project: Project,
  audio: Record<string, AudioBuffer>
): AudioBuffer | undefined {
  return tracksOf(project, 'backing')
    .filter((t) => !t.muted)
    .flatMap((t) => t.clips.map((c) => audio[c.file]))
    .find((b): b is AudioBuffer => !!b)
}

/**
 * The key Tuning pulls toward: heard from the music, moved with the Key knob. Songs
 * saved with a chosen key keep it. Null without music: Tuning then uses any note.
 */
export async function songKeyOf(
  project: Project,
  audio: Record<string, AudioBuffer>
): Promise<SongKey | null> {
  if (project.key) return project.key
  const recording = musicRecording(project, audio)
  const original = recording ? await keyOfRecording(recording) : null
  return original && transposeKey(original, musicOf(project).semitones)
}

/** `songKeyOf`, kept up to date as the music or its key changes. */
export function useSongKey(
  project: Project | undefined,
  audio: Record<string, AudioBuffer>
): SongKey | null {
  const recording = project ? musicRecording(project, audio) : undefined
  const [result, setResult] = useState<{ recording: AudioBuffer; key: SongKey | null } | null>(null)
  useEffect(() => {
    if (!recording) return
    let cancelled = false
    void keyOfRecording(recording).then((key) => {
      if (!cancelled) setResult({ recording, key })
    })
    return () => {
      cancelled = true
    }
  }, [recording])
  if (!project) return null
  if (project.key) return project.key
  const original = result && result.recording === recording ? result.key : null
  return original && transposeKey(original, musicOf(project).semitones)
}
