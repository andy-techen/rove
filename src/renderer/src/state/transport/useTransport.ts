import { useEffect, useRef, useState } from 'react'
import { t } from '@shared/copy'
import { Recorder, createRecorder, getAudioContext, loadWorklets } from '../../audio/engine/engine'
import { alignTake } from '../../audio/engine/latency'
import { MIN_LINE_UP_SEC, musicUnder, takeLag } from '../../audio/engine/lineUp'
import { PhraseTiming, harmonyTiming } from '../../audio/engine/harmonySync'
import { balancedMusicVolume } from '../../audio/mix/balance'
import { Mixer } from '../../audio/mix/mixer'
import { ScheduledClip, onAllEnded, scheduleClips, stopNodes } from '../../audio/mix/playback'
import { ClickTrack, scheduleClicks } from '../../audio/mix/click'
import { encodeWav } from '../../audio/encode/wav'
import { PeakAccumulator } from '../../audio/mix/peaks'
import {
  Clip,
  Project,
  Track,
  TrackRole,
  canBalanceMusic,
  findClip,
  lineUpClip,
  syncPhrases,
  withMusicVolume,
  withRecordedClip
} from '../song/project'
import { playbackKey, trackMixes } from '../song/selectors'
import { ProcessedAudio, bufferFor } from '../processing/processedAudio'
import { Song } from '../song/useSong'
import { showSnack } from '../ui/snackbar'
import { ChordPart } from '../chords/chart'
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

/** Stops a session's audio now, or at `atTime` on the audio clock. */
function endSession(s: Session, atTime?: number): void {
  stopNodes(s.nodes, atTime)
  for (const clicks of s.clicks) clicks.stop(atTime)
}

/** The metronome: where it ticks, and how loud (0 is off). */
export interface Metronome {
  grid: ClickGrid | null
  level: number
}

/**
 * A just-recorded take whose timing Rove can fix: one off the beat, by how far (seconds;
 * positive is late), or a harmony whose phrases land apart from the lead's.
 */
export type TakeOffer = { trackId: string; clipId: string } & (
  { kind: 'lineUp'; bySec: number } | { kind: 'syncHarmony'; phrases: PhraseTiming[] }
)

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
  /** Linear gain on the master bus (1 = unity). Not saved: a session-level comfort knob. */
  masterVolume: number
  /** When true, the master bus plays silent but the chosen volume is remembered. */
  masterMuted: boolean
  setMasterVolume(value: number): void
  toggleMasterMuted(): void
  togglePlay(): void
  /** Stops playback and goes back to the start of the song. */
  stopPlayback(): void
  seek(sec: number): void
  record(trackId: string): Promise<void>
  stop(): Promise<void>
  /** Drops the take being recorded, unsaved, and starts it again from the same place. */
  restartTake(): Promise<void>
  /** The last take sits off the music or the lead; null when it's in time or unclear. */
  offer: TakeOffer | null
  /**
   * Moves that take into time (lining up also teaches the delay to later takes), or
   * syncs the harmony's phrases with the lead.
   */
  applyOffer(): void
  /** Leaves that take where it is; the offer goes. */
  dismissOffer(): void
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
    parts,
    waiting,
    metronome,
    hearSelf,
    onLinedUp
  }: {
    latencySec: number
    /** A take was lined up by this much: later takes on this setup should be too. */
    onLinedUp?(bySec: number): void
    /** Play the mic back while recording (off through speakers, or it would howl). */
    hearSelf: boolean
    processed: ProcessedAudio
    /** What the chords track plays, rendered. */
    parts: ChordPart[]
    waiting: boolean
    metronome: Metronome
  }
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
  const [offer, setOffer] = useState<TakeOffer | null>(null)
  const [masterVolume, setMasterVolume] = useState(1)
  const [masterMuted, setMasterMuted] = useState(false)
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

  // Mirrors the session-level master volume onto the mixer bus. setTargetAtTime
  // ramps instead of writing .value directly (which the hook linter flags as mutation),
  // and also keeps the master steady across export, which writes master.gain itself.
  useEffect(() => {
    if (!mixer) return
    const ctx = getAudioContext()
    const target = masterMuted ? 0 : masterVolume
    mixer.master.gain.setTargetAtTime(target, ctx.currentTime, 0.01)
  }, [mixer, masterVolume, masterMuted, mode])

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
  // Through speakers the mic would pick itself up and howl, and a mic that plays the
  // singer back itself would make this a late second copy, so then they hear only the music.
  const recordingTrackId = live?.trackId ?? null
  useEffect(() => {
    if (!source || !recordingTrackId || !mixer || !hearSelf) return
    const gain = source.context.createGain()
    gain.gain.value = MONITOR_GAIN
    source.connect(gain).connect(mixer.input(recordingTrackId))
    return () => {
      source.disconnect(gain)
      gain.disconnect()
    }
  }, [source, recordingTrackId, mixer, hearSelf])

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

  const clipsOf = (
    role: TrackRole,
    excludeTrackId?: string,
    keep: (track: Track) => boolean = () => true
  ): ScheduledClip[] =>
    !mixer
      ? []
      : (tracks ?? [])
          .filter((t) => t.role === role && t.id !== excludeTrackId && keep(t))
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

  /** The chords track's sound, as the one clip it plays. */
  const chordClips = (): ScheduledClip[] =>
    !mixer
      ? []
      : parts.map((part) => ({
          buffer: part.buffer,
          output: mixer.input(part.trackId),
          start: part.start,
          offset: 0,
          duration: part.buffer.duration
        }))

  const startPlayback = async (fromSec: number): Promise<void> => {
    const ctx = getAudioContext()
    await ctx.resume()
    const startAt = ctx.currentTime + PLAY_LEAD_SEC
    const nodes = scheduleClips(
      ctx,
      [...clipsOf('backing'), ...chordClips(), ...clipsOf('vocal')],
      fromSec,
      startAt
    )
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

  /** The take's stretch of the take and of the music under it, as mono samples. */
  const takeAndMusic = (
    trackId: string,
    clip: Pick<Clip, 'start' | 'offset' | 'duration'>,
    audio: AudioBuffer,
    roles: TrackRole[]
  ): { voice: Float32Array; music: Float32Array; sampleRate: number } | null => {
    const clips = roles.flatMap((role) =>
      role === 'chords' ? chordClips() : clipsOf(role, trackId)
    )
    if (clips.length === 0) return null
    const { sampleRate } = audio
    const from = Math.round(clip.offset * sampleRate)
    const length = Math.min(audio.length - from, Math.round(clip.duration * sampleRate))
    return {
      voice: audio.getChannelData(0).subarray(from, from + length),
      music: musicUnder(clips, clip.start, length, sampleRate),
      sampleRate
    }
  }

  /**
   * A first take over untouched music sets the music's volume so the voice sits on top,
   * instead of leaving the singer to find it (and to reach for the Mac's volume).
   */
  const withBalance = (
    project: Project,
    trackId: string,
    clip: Pick<Clip, 'start' | 'offset' | 'duration'>,
    audio: AudioBuffer
  ): Project | null => {
    if (!canBalanceMusic(project, trackId)) return null
    const heard = takeAndMusic(trackId, clip, audio, ['backing'])
    const volume = heard && balancedMusicVolume(heard.voice, heard.music, heard.sampleRate)
    return typeof volume === 'number' ? withMusicVolume(project, volume) : null
  }

  /**
   * A harmony sung over the lead is checked against the lead, phrase by phrase: true when
   * there was a lead to check against (whether or not anything needs moving).
   */
  const checkAgainstLead = (
    trackId: string,
    clip: Pick<Clip, 'id' | 'start' | 'offset' | 'duration'>,
    audio: AudioBuffer
  ): boolean => {
    const track = tracks?.find((t) => t.id === trackId)
    if (track?.role !== 'vocal' || track.part !== 'harmony') return false
    const lead = clipsOf('vocal', trackId, (t) => t.part !== 'harmony').filter(
      (c) => c.start < clip.start + clip.duration && c.start + c.duration > clip.start
    )
    if (lead.length === 0) return false
    const { sampleRate } = audio
    const from = Math.round(clip.offset * sampleRate)
    const length = Math.min(audio.length - from, Math.round(clip.duration * sampleRate))
    const harmony = audio.getChannelData(0).subarray(from, from + length)
    const phrases = harmonyTiming(
      harmony,
      musicUnder(lead, clip.start, length, sampleRate),
      sampleRate
    )
    if (phrases) setOffer({ kind: 'syncHarmony', trackId, clipId: clip.id, phrases })
    return true
  }

  /**
   * Checks a new take against what it was sung to, and offers to fix its timing if it's
   * off: a harmony against the lead, anything else against the music.
   */
  const checkTiming = async (
    trackId: string,
    clip: Pick<Clip, 'id' | 'start' | 'offset' | 'duration'>,
    audio: AudioBuffer
  ): Promise<void> => {
    // Syncing with the lead covers any delay the music check would find too, if the lead
    // is in time; and if it isn't, a harmony should still follow the lead.
    if (checkAgainstLead(trackId, clip, audio)) return
    const heard = takeAndMusic(trackId, clip, audio, ['backing', 'chords'])
    if (!heard) return
    const { voice, music, sampleRate } = heard
    const lag = await takeLag({ channels: [voice], sampleRate }, { channels: [music], sampleRate })
    if (lag !== null && Math.abs(lag) >= MIN_LINE_UP_SEC) {
      setOffer({ kind: 'lineUp', trackId, clipId: clip.id, bySec: lag })
    }
  }

  const persistTake = async (take: PendingTake): Promise<void> => {
    if (!open) return
    let file = take.file
    try {
      file ??= await window.api.saveTake(open.dir, take.wav)
      const clip = {
        id: crypto.randomUUID(),
        file,
        ...alignTake(take.fromSec, take.audio.duration, latencySec)
      }
      const recorded = withRecordedClip(open.data, take.trackId, clip)
      const balanced = withBalance(recorded, take.trackId, clip, take.audio)
      await song.saveProject(balanced ?? recorded, { file, audio: take.audio })
      setPending(null)
      setError(null)
      if (balanced) showSnack(t('transport.balanced'))
      // Timing is a suggestion on top of a saved take; if the check fails, nothing's lost.
      checkTiming(take.trackId, clip, take.audio).catch(() => {})
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

  const record = async (trackId: string, from?: number): Promise<void> => {
    if (!recorder || !open) return
    const ctx = getAudioContext()
    await ctx.resume()
    setStatus(null)
    setError(null)
    setOffer(null)
    const { grid, level } = metronome
    // Pressed while the song plays: the music carries straight on into the take, so the
    // singer comes in where they heard it. Playback hands over on the frame the take
    // starts, and there's no count-in: they're already in the song.
    const playing = mode === 'playing' ? session.current : null
    let fromSec = from ?? position
    let countIn = 0
    let startAt: number
    if (playing) {
      startAt = ctx.currentTime + START_LEAD_SEC
      fromSec = positionNow() + START_LEAD_SEC
      endSession(playing, startAt)
      session.current = null
    } else {
      // With the click on, one bar of ticks counts the singer in before the take starts.
      countIn = grid && level > 0 ? countInSec(grid) : 0
      startAt = ctx.currentTime + START_LEAD_SEC + countIn
    }
    // The singer hears the music plus every other vocal, for layering harmonies; the
    // track being recorded (vocal or backing) stays silent so it isn't sung over twice.
    const backingNodes = scheduleClips(
      ctx,
      [...clipsOf('backing', trackId), ...chordClips()],
      fromSec,
      startAt
    )
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

  const restartTake = async (): Promise<void> => {
    const s = session.current
    if (mode !== 'recording' || !s?.recordTrackId || !recorder) return
    endSession(s)
    session.current = null
    setLive(null)
    // The take so far only lives in memory: it's let go without ever being written.
    await recorder.stop()
    await record(s.recordTrackId, s.fromSec)
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

  // New chords (or the chords at a new speed or key) are heard straight away too.
  const playingChords = useRef(parts)
  useEffect(() => {
    if (playingChords.current === parts) return
    playingChords.current = parts
    restartRef.current()
  }, [parts])

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

  const hasAudio =
    parts.length > 0 || (tracks ?? []).some((t) => t.clips.some((c) => audio[c.file]))

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
    masterVolume,
    masterMuted,
    setMasterVolume,
    toggleMasterMuted: () => setMasterMuted((v) => !v),
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
    restartTake,
    // Gone once its clip is (undone, deleted or recorded over).
    offer: offer && project && findClip(project, offer.trackId, offer.clipId) ? offer : null,
    applyOffer: () => {
      if (!offer || !project) return
      if (offer.kind === 'lineUp') {
        song.edit(lineUpClip(project, offer.trackId, offer.clipId, offer.bySec))
        onLinedUp?.(offer.bySec)
        showSnack(t('transport.lineUp.done'))
      } else {
        song.edit(syncPhrases(project, offer.trackId, offer.clipId, offer.phrases))
        showSnack(t('transport.harmonySync.done'))
      }
      setOffer(null)
    },
    dismissOffer: () => setOffer(null),
    retrySave: async () => {
      if (pending) await persistTake(pending)
    },
    discardPending: () => setPending(null)
  }
}
