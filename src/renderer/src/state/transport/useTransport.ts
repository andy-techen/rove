import { useEffect, useRef, useState } from 'react'
import { t } from '@shared/copy'
import { Recorder, createRecorder, getAudioContext, loadWorklets } from '../../audio/engine/engine'
import { alignTake } from '../../audio/engine/latency'
import { Mixer } from '../../audio/mix/mixer'
import { ScheduledClip, onAllEnded, scheduleClips, stopNodes } from '../../audio/mix/playback'
import { ClickTrack, scheduleClicks } from '../../audio/mix/click'
import { encodeWav } from '../../audio/encode/wav'
import { PeakAccumulator } from '../../audio/mix/peaks'
import { TrackRole, withRecordedClip } from '../song/project'
import { playbackKey, trackMixes } from '../song/selectors'
import { ProcessedAudio, bufferFor } from '../processing/processedAudio'
import { Song } from '../song/useSong'
import { ClickGrid, clickTimes, countInSec, countInTicks } from './metronome'

export type Mode = 'idle' | 'playing' | 'recording' | 'saving'

export interface LiveTake {
  trackId: string
  startSec: number
  peaks: PeakAccumulator
}

interface PendingTake {
  trackId: string
  fromSec: number
  wav: ArrayBuffer
  audio: AudioBuffer
  /** Set once the WAV is on disk, so a retry only rewrites project.json. */
  file?: string
}

interface Session {
  startAt: number
  fromSec: number
  nodes: AudioBufferSourceNode[]
  /** The metronome for this run, separate so it never decides when playback ends. */
  clicks: ClickTrack[]
  recordTrackId?: string
}

/** Stops everything a run scheduled: its clips and its clicks. */
function endSession(s: Session): void {
  stopNodes(s.nodes)
  for (const clicks of s.clicks) clicks.stop()
}

/** The metronome: where it ticks, and how loud (0 is off). */
export interface Metronome {
  grid: ClickGrid | null
  level: number
}

export interface Transport {
  mode: Mode
  position: number
  live: LiveTake | null
  status: string | null
  error: string | null
  hasPendingTake: boolean
  canPlay: boolean
  /** Playing, or paused somewhere past the start. */
  canStop: boolean
  recorderReady: boolean
  togglePlay(): void
  /** Stops playback and goes back to the start of the song. */
  stopPlayback(): void
  seek(sec: number): void
  record(trackId: string): Promise<void>
  stop(): Promise<void>
  retrySave(): Promise<void>
  discardPending(): void
}

// Scheduling slightly ahead lets the recorder's start message reach the audio
// thread before the frame the music starts on.
const START_LEAD_SEC = 0.2
const PLAY_LEAD_SEC = 0.05
const MIN_TAKE_SEC = 0.5
// 10 ms of audio per live-waveform bucket at 48 kHz.
const LIVE_BUCKET_SAMPLES = 480
// The live mic sits a little under the mix so it doesn't overpower the music.
const MONITOR_GAIN = 0.8

// An edit made while playing is heard once it settles, so dragging a clip restarts
// playback once on release rather than on every pointer move.
const EDIT_SETTLE_MS = 150

export function useTransport(
  song: Song,
  source: MediaStreamAudioSourceNode | null,
  {
    latencySec,
    processed,
    waiting,
    metronome
  }: { latencySec: number; processed: ProcessedAudio; waiting: boolean; metronome: Metronome }
): Transport {
  const { song: open, audio } = song
  const [mixer, setMixer] = useState<Mixer | null>(null)
  const [mode, setMode] = useState<Mode>('idle')
  const [position, setPosition] = useState(0)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingTake | null>(null)
  const [recorder, setRecorder] = useState<Recorder | null>(null)
  const [live, setLive] = useState<LiveTake | null>(null)
  const session = useRef<Session | null>(null)
  const onEndedRef = useRef<() => void>(() => {})
  const restartRef = useRef<() => void>(() => {})

  // The polish chain runs on the audio thread, so the mixer waits for its processors.
  useEffect(() => {
    let alive = true
    const ctx = getAudioContext()
    loadWorklets(ctx)
      .then(() => alive && setMixer(new Mixer(ctx)))
      .catch(() => alive && setError(t('transport.engineFailed')))
    return () => {
      alive = false
    }
  }, [])

  const tracks = open?.data.tracks
  const project = open?.data
  useEffect(() => {
    mixer?.sync(project ? trackMixes(project) : [])
  }, [mixer, project])

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
      .catch(() => !cancelled && setError(t('transport.recorderFailed')))
    return () => {
      cancelled = true
      if (session.current) endSession(session.current)
      session.current = null
      created?.dispose()
      setRecorder(null)
    }
  }, [source])

  // While recording, the singer hears themselves through the track being recorded,
  // so that track's mute, volume and position (and polish) apply to what they hear.
  const recordingTrackId = live?.trackId ?? null
  useEffect(() => {
    if (!source || !recordingTrackId || !mixer) return
    const gain = source.context.createGain()
    gain.gain.value = MONITOR_GAIN
    source.connect(gain).connect(mixer.input(recordingTrackId))
    return () => {
      source.disconnect(gain)
      gain.disconnect()
    }
  }, [source, recordingTrackId, mixer])

  /** The metronome from `fromSec` on, ticking from `atTime` (silent while the level is 0). */
  const startClicks = (ctx: AudioContext, fromSec: number, atTime: number): ClickTrack[] => {
    const { grid, level } = metronome
    if (!grid) return []
    const end = grid.toSec
    return [scheduleClicks(ctx, clickTimes(grid, fromSec, end), fromSec, atTime, level)]
  }

  const positionNow = (): number => {
    const s = session.current
    if (!s) return position
    return s.fromSec + Math.max(0, getAudioContext().currentTime - s.startAt)
  }

  useEffect(() => {
    if (mode !== 'playing' && mode !== 'recording') return
    let raf = 0
    const tick = (): void => {
      const s = session.current
      if (s) setPosition(s.fromSec + Math.max(0, getAudioContext().currentTime - s.startAt))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [mode])

  const clipsOf = (role: TrackRole, excludeTrackId?: string): ScheduledClip[] =>
    !mixer
      ? []
      : (tracks ?? [])
          .filter((t) => t.role === role && t.id !== excludeTrackId)
          .flatMap((t) =>
            t.clips.flatMap((c) => {
              const buffer = bufferFor(audio, processed, t.id, c.file)
              if (!buffer) return []
              return [
                {
                  buffer,
                  output: mixer.input(t.id),
                  start: c.start,
                  offset: c.offset,
                  duration: c.duration || buffer.duration,
                  fadeIn: c.fadeIn,
                  fadeOut: c.fadeOut
                }
              ]
            })
          )

  const startPlayback = async (fromSec: number): Promise<void> => {
    const ctx = getAudioContext()
    await ctx.resume()
    const startAt = ctx.currentTime + PLAY_LEAD_SEC
    const nodes = scheduleClips(ctx, [...clipsOf('backing'), ...clipsOf('vocal')], fromSec, startAt)
    if (nodes.length === 0) {
      setPosition(fromSec)
      setMode('idle')
      return
    }
    onAllEnded(nodes, () => onEndedRef.current())
    session.current = { startAt, fromSec, nodes, clicks: startClicks(ctx, fromSec, startAt) }
    setStatus(null)
    setMode('playing')
  }

  const pause = (): void => {
    const s = session.current
    if (!s) return
    const at = positionNow()
    endSession(s)
    session.current = null
    setPosition(at)
    setMode('idle')
  }

  const persistTake = async (take: PendingTake): Promise<void> => {
    if (!open) return
    let file = take.file
    try {
      file ??= await window.api.saveTake(open.dir, take.wav)
      const placed = alignTake(take.fromSec, take.audio.duration, latencySec)
      const data = withRecordedClip(open.data, take.trackId, { file, ...placed })
      await song.saveProject(data, { file, audio: take.audio })
      setPending(null)
      setError(null)
    } catch {
      setPending({ ...take, file })
      setError(t('transport.saveFailed'))
    }
  }

  const stop = async (): Promise<void> => {
    const s = session.current
    if (!s?.recordTrackId || !recorder) return
    const end = positionNow()
    endSession(s)
    session.current = null
    setPosition(end)
    setLive(null)
    setMode('saving')
    const samples = await recorder.stop()
    const { sampleRate } = getAudioContext()
    if (samples.length / sampleRate < MIN_TAKE_SEC) {
      setStatus(t('transport.tooShort'))
    } else {
      const take = new AudioBuffer({ length: samples.length, sampleRate, numberOfChannels: 1 })
      take.copyToChannel(samples, 0)
      await persistTake({
        trackId: s.recordTrackId,
        fromSec: s.fromSec,
        wav: encodeWav([samples], sampleRate),
        audio: take
      })
    }
    setMode('idle')
  }

  const record = async (trackId: string): Promise<void> => {
    if (!recorder || !open) return
    const ctx = getAudioContext()
    await ctx.resume()
    setStatus(null)
    setError(null)
    const fromSec = position
    // With the click on, one bar of ticks counts the singer in before the take starts.
    const { grid, level } = metronome
    const countIn = grid && level > 0 ? countInSec(grid) : 0
    const startAt = ctx.currentTime + START_LEAD_SEC + countIn
    // The singer hears the music plus every other vocal, for layering harmonies; the
    // track being recorded (vocal or backing) stays silent so it isn't sung over twice.
    const backingNodes = scheduleClips(ctx, clipsOf('backing', trackId), fromSec, startAt)
    const vocalNodes = scheduleClips(ctx, clipsOf('vocal', trackId), fromSec, startAt)
    // When the music runs out, so does the take.
    onAllEnded(backingNodes, () => onEndedRef.current())
    const peaks = new PeakAccumulator(LIVE_BUCKET_SAMPLES)
    recorder.start(startAt, (chunk) => peaks.push(chunk))
    const countInClicks =
      grid && countIn > 0
        ? [scheduleClicks(ctx, countInTicks(grid), -countIn, startAt - countIn, level)]
        : []
    session.current = {
      startAt,
      fromSec,
      nodes: [...backingNodes, ...vocalNodes],
      clicks: [...countInClicks, ...startClicks(ctx, fromSec, startAt)],
      recordTrackId: trackId
    }
    setLive({ trackId, startSec: fromSec, peaks })
    setMode('recording')
  }

  // Playback ending naturally pauses at the end; the music ending stops a take.
  useEffect(() => {
    onEndedRef.current = () => {
      if (mode === 'recording') void stop()
      else if (mode === 'playing') pause()
    }
    restartRef.current = () => {
      if (mode !== 'playing' || !session.current) return
      // Music at a new speed isn't ready yet; playing on would be out of time.
      if (waiting) return pause()
      const at = positionNow()
      endSession(session.current)
      session.current = null
      void startPlayback(at)
    }
  })

  // Turning the click up or down is heard straight away.
  useEffect(() => {
    for (const clicks of session.current?.clicks ?? []) clicks.setLevel(metronome.level)
  }, [metronome.level])

  // A new tuning (or music speed or key) is heard straight away: playback picks up
  // from the same spot with the new copies. A take being recorded carries on undisturbed.
  const playing = useRef(processed)
  useEffect(() => {
    if (playing.current === processed) return
    playing.current = processed
    restartRef.current()
  }, [processed])

  // A clip moved, trimmed, split or deleted, or a track removed, while playing: playback
  // picks up from the same spot with the song as it is now.
  const lineUp = project ? playbackKey(project) : ''
  const linedUp = useRef(lineUp)
  useEffect(() => {
    if (linedUp.current === lineUp) return
    linedUp.current = lineUp
    if (mode !== 'playing') return
    const timer = setTimeout(() => restartRef.current(), EDIT_SETTLE_MS)
    return () => clearTimeout(timer)
  }, [lineUp, mode])

  const hasAudio = (tracks ?? []).some((t) => t.clips.some((c) => audio[c.file]))

  return {
    mode,
    position,
    live,
    status,
    error,
    hasPendingTake: pending !== null,
    canPlay: !!mixer && hasAudio && !waiting && (mode === 'idle' || mode === 'playing'),
    canStop: mode === 'playing' || (mode === 'idle' && position > 0),
    recorderReady: recorder !== null && mixer !== null,
    togglePlay: () => {
      if (mode === 'playing') pause()
      else if (mode === 'idle') void startPlayback(position)
    },
    stopPlayback: () => {
      if (mode !== 'playing' && mode !== 'idle') return
      if (session.current) endSession(session.current)
      session.current = null
      setPosition(0)
      setMode('idle')
    },
    seek: (sec) => {
      if (mode === 'recording' || mode === 'saving') return
      const target = Math.max(0, sec)
      if (mode === 'playing' && session.current) {
        endSession(session.current)
        session.current = null
        void startPlayback(target)
      } else {
        setPosition(target)
      }
    },
    record,
    stop,
    retrySave: async () => {
      if (pending) await persistTake(pending)
    },
    discardPending: () => setPending(null)
  }
}
