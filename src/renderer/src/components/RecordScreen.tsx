import { useEffect, useRef, useState } from 'react'
import { Recorder, createRecorder, getAudioContext } from '../audio/engine'
import { encodeWav } from '../audio/wav'
import { formatDuration, leadTakes, withTake } from '../state/project'
import { Song } from '../state/useSong'
import { InputMeter } from './InputMeter'

interface Props {
  source: MediaStreamAudioSourceNode | null
  inputError: string | null
  deviceLabel: string
  song: Song
  onBack(): void
}

interface PendingTake {
  wav: ArrayBuffer
  duration: number
  /** Set once the WAV is on disk, so a retry only rewrites project.json. */
  file?: string
}

type Phase = 'idle' | 'recording' | 'saving'

// Scheduling slightly ahead lets the recorder's start message reach the audio
// thread before the frame the backing track starts on.
const START_LEAD_SEC = 0.2
const MIN_TAKE_SEC = 0.5

export function RecordScreen({
  source,
  inputError,
  deviceLabel,
  song,
  onBack
}: Props): React.JSX.Element {
  const { song: open, backing, skipBacking, busy } = song
  const [phase, setPhase] = useState<Phase>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [status, setStatus] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingTake | null>(null)
  const [recorder, setRecorder] = useState<Recorder | null>(null)
  const session = useRef<{ startAt: number; playback: AudioBufferSourceNode | null } | null>(null)
  const stopRef = useRef<() => Promise<void>>(async () => {})

  useEffect(() => {
    if (!source) return
    let cancelled = false
    let created: Recorder | null = null
    createRecorder(source)
      .then((r) => {
        if (cancelled) return r.dispose()
        created = r
        setRecorder(r)
      })
      .catch(() => !cancelled && setSaveError("Couldn't start the recorder."))
    return () => {
      cancelled = true
      session.current?.playback?.stop()
      session.current = null
      created?.dispose()
      setRecorder(null)
    }
  }, [source])

  useEffect(() => {
    if (phase !== 'recording') return
    const ctx = getAudioContext()
    const id = setInterval(() => {
      setElapsed(Math.max(0, ctx.currentTime - (session.current?.startAt ?? ctx.currentTime)))
    }, 200)
    return () => clearInterval(id)
  }, [phase])

  const persistTake = async (take: PendingTake): Promise<void> => {
    if (!open) return
    let file = take.file
    try {
      file ??= await window.api.saveTake(open.dir, take.wav)
      const data = withTake(open.data, file, take.duration)
      await window.api.writeManifest(open.dir, data)
      song.updateProject(data)
      setPending(null)
      setSaveError(null)
      setStatus(`Take ${leadTakes(data).length} saved (${formatDuration(take.duration)}).`)
    } catch {
      setPending({ ...take, file })
      setSaveError("Couldn't save that take to your song folder. Check the folder still exists.")
    }
  }

  const stopRecording = async (): Promise<void> => {
    const current = session.current
    if (!current || !recorder) return
    session.current = null
    if (current.playback) {
      current.playback.onended = null
      current.playback.stop()
      current.playback.disconnect()
    }
    setPhase('saving')
    const samples = await recorder.stop()
    const { sampleRate } = getAudioContext()
    const duration = samples.length / sampleRate
    if (duration < MIN_TAKE_SEC) {
      setStatus('That take was too short to keep.')
    } else {
      await persistTake({ wav: encodeWav(samples, sampleRate), duration })
    }
    setPhase('idle')
  }

  useEffect(() => {
    stopRef.current = stopRecording
  })

  const startRecording = async (): Promise<void> => {
    if (!recorder || !open) return
    const ctx = getAudioContext()
    await ctx.resume()
    setStatus(null)
    setSaveError(null)
    setElapsed(0)
    const startAt = ctx.currentTime + START_LEAD_SEC
    let playback: AudioBufferSourceNode | null = null
    if (backing) {
      playback = ctx.createBufferSource()
      playback.buffer = backing
      playback.connect(ctx.destination)
      // Reaching the end of the song finishes the take automatically.
      playback.onended = () => void stopRef.current()
      playback.start(startAt)
    }
    recorder.start(startAt)
    session.current = { startAt, playback }
    setPhase('recording')
  }

  const recording = phase === 'recording'
  const ready = !!open && (!!backing || skipBacking)
  const canRecord = ready && !!recorder && phase === 'idle' && !pending && !busy
  const takes = open ? leadTakes(open.data) : []
  const error = song.error ?? saveError

  return (
    <main className="app">
      <header>
        <h1>Ready to record</h1>
        <p className="subtitle">{deviceLabel}</p>
      </header>

      <section className="card stack">
        <h2 className="step-title">1. Song folder</h2>
        {open ? (
          <div className="row spread">
            <span>{open.data.name}</span>
            <button
              className="secondary"
              disabled={phase !== 'idle' || busy}
              onClick={song.chooseFolder}
            >
              Change
            </button>
          </div>
        ) : (
          <>
            <p className="muted">
              Pick a folder for this song. Rove keeps your backing track and recordings there.
            </p>
            <div className="row">
              <button disabled={busy} onClick={song.chooseFolder}>
                Choose folder
              </button>
            </div>
          </>
        )}
      </section>

      {open && (
        <section className="card stack">
          <h2 className="step-title">2. Backing track</h2>
          {backing && open.data.backingTrack ? (
            <div className="row spread">
              <span>
                {open.data.backingTrack.name}{' '}
                <span className="muted">{formatDuration(backing.duration)}</span>
              </span>
              <button
                className="secondary"
                disabled={phase !== 'idle' || busy}
                onClick={song.addBackingTrack}
              >
                Replace
              </button>
            </div>
          ) : (
            <>
              <p className="muted">
                {skipBacking
                  ? 'Recording without music.'
                  : 'Add the music you’ll sing along to. Rove copies it into your song folder.'}
              </p>
              <div className="row">
                <button disabled={phase !== 'idle' || busy} onClick={song.addBackingTrack}>
                  Add backing track
                </button>
                {!skipBacking && (
                  <button className="secondary" disabled={busy} onClick={song.recordWithoutMusic}>
                    Record without music
                  </button>
                )}
              </div>
            </>
          )}
        </section>
      )}

      {ready && (
        <section className="card stack">
          <h2 className="step-title">3. Record</h2>
          {inputError && <p className="error">{inputError}</p>}
          {source && <InputMeter source={source} />}
          <div className="row record-row">
            {recording ? (
              <button className="record-button recording" onClick={stopRecording}>
                Stop
              </button>
            ) : (
              <button className="record-button" disabled={!canRecord} onClick={startRecording}>
                Record
              </button>
            )}
            <span className="timer" aria-live="off">
              {formatDuration(elapsed)}
            </span>
          </div>
          {backing && phase === 'idle' && (
            <p className="muted">
              The music starts when you press Record and the take ends with the song. Wear
              headphones so the music stays out of your vocal.
            </p>
          )}
          {phase === 'saving' && <p className="muted">Saving…</p>}
          {status && <p>{status}</p>}
          {pending && (
            <div className="row">
              <button onClick={() => persistTake(pending)}>Try saving again</button>
              <button className="secondary" onClick={() => setPending(null)}>
                Discard take
              </button>
            </div>
          )}
          {takes.length > 0 && (
            <ol className="takes">
              {takes.map((clip, i) => (
                <li key={clip.id}>
                  Take {i + 1} <span className="muted">{formatDuration(clip.duration)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      {error && <p className="error">{error}</p>}

      <div className="row">
        <button className="secondary" disabled={phase !== 'idle'} onClick={onBack}>
          Back to mic check
        </button>
      </div>
    </main>
  )
}
