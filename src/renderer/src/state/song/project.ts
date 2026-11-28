import { SongKey, transposeKey } from '../../audio/pitch/key'
import type { Chord } from '../../audio/music/chords'
import { moveItem } from '../tabs/tabOrder'
import { SongLyrics } from '../lyrics/lyrics'
import { PolishSettings, defaultPolish } from '../../audio/polish/polish'
import type { PolishSuggestion } from '../../audio/polish/autoPolish'
import { t } from '@shared/copy'

export interface Clip {
  id: string
  file: string
  /** Where the clip sits on the timeline, in seconds. */
  start: number
  /** Where inside the file playback begins, in seconds (for trimming later). */
  offset: number
  /** How much of the file plays, in seconds. */
  duration: number
  /** Seconds to fade in from silence at the clip's start. */
  fadeIn?: number
  /** Seconds to fade out to silence at the clip's end. */
  fadeOut?: number
  /** Set when the vocals were removed: the song this clip played before (still on disk). */
  withVocals?: string
  /** Clips sharing a group id are picked, moved, copied and deleted together. */
  group?: string
}

/**
 * Vocals are sung; backing tracks play music files; a chords track plays the chords the
 * singer wrote. Both kinds of music are "Backing" to the singer.
 */
export type TrackRole = 'vocal' | 'backing' | 'chords'
export type VocalPart = 'lead' | 'harmony'

export interface Track {
  id: string
  role: TrackRole
  /** Vocal tracks only; decides the starting mix. */
  part?: VocalPart
  name: string
  /** Original file name, for backing tracks imported from the user's library. */
  sourceName?: string
  volume: number
  pan: number
  muted: boolean
  /** Vocal tracks only. */
  polish?: PolishSettings
  /** Vocal tracks only: what auto polish suggested, set when the singer asked for it. */
  polishSuggestion?: PolishSuggestion
  /** Chords tracks only: the chords it plays. */
  chart?: ChordChart
  /** Chords tracks only: what plays them; unset is guitar. */
  instrument?: Instrument
  /** Chords tracks only: the drums, once the track has played Beats. */
  beats?: BeatChart
  clips: Clip[]
}

export interface Project {
  version: 2
  name: string
  /** Who's singing it. Optional; shown in the Songbook and used by later voice features. */
  artist?: string | null
  /** The singer's own reminder, set from the Songbook ("learn the bridge"). */
  note?: string | null
  sampleRate: number
  /** What tuning pulls notes toward; unset or null means the nearest of any note. */
  key?: SongKey | null
  lyrics?: SongLyrics | null
  /** How the backing music is played: unset means as it was recorded. */
  music?: Partial<MusicSettings>
  /** Set once the song has an instrumental; see `tempoOf`. */
  tempo?: SongTempo
  tracks: Track[]
}

/**
 * The song's beat, shared by every instrumental and the metronome so they stay in step:
 * at the original speed. Speed applies when it plays, as it does to music files.
 */
export interface SongTempo {
  bpm: number
  beatsPerBar: BeatsPerBar
  /** Where bar 1 starts on the timeline, in seconds at the original speed. */
  startSec: number
}

/**
 * An instrumental's chords, bar by bar, as written: in the original key, which Key moves
 * when it plays. It keeps time with the song's tempo.
 */
export interface ChordChart {
  /** Each bar's chords, sharing the bar evenly; an empty bar carries the last chord on. */
  bars: Chord[][]
  /** How each bar is played, alongside `bars`; a bar without one is strummed. */
  feels?: ChordFeel[]
}

export type BeatsPerBar = 3 | 4
/**
 * How a bar is played. The guitar's feels and the piano's share each bar's one slot, so
 * moving, copying or deleting bars carries both; each instrument reads the other's as
 * its nearest equivalent (`guitarFeel`, `pianoFeel`).
 */
export type ChordFeel = GuitarFeel | PianoFeel
/** Strummed across the strings, or fingerpicked a string at a time. */
export type GuitarFeel = 'strum' | 'pick'
/** One held chord a bar, or the chord's notes rolled up one a beat (shown as "Ballad"). */
export type PianoFeel = 'chords' | 'flowing'
export const GUITAR_FEELS: readonly GuitarFeel[] = ['strum', 'pick']
export const PIANO_FEELS: readonly PianoFeel[] = ['chords', 'flowing']
const CHORD_FEELS: readonly ChordFeel[] = [...GUITAR_FEELS, ...PIANO_FEELS]

/** A bar's feel as the guitar plays it: rolling piano parts are fingerpicked. */
export const guitarFeel = (feel: ChordFeel): GuitarFeel =>
  feel === 'pick' || feel === 'flowing' ? 'pick' : 'strum'

/** A bar's feel as the piano plays it: a strum is struck chords, a pick rolls. */
export const pianoFeel = (feel: ChordFeel): PianoFeel =>
  feel === 'pick' || feel === 'flowing' ? 'flowing' : 'chords'

/** What an instrumental plays: a guitar or piano from its chords, or drums. */
export type Instrument = 'guitar' | 'piano' | 'beats'
export const INSTRUMENTS: readonly Instrument[] = ['guitar', 'piano', 'beats']

/** The drums' style for the whole song. Pop first; more grooves come later. */
export type GrooveId = 'pop'
export const GROOVE_IDS: readonly GrooveId[] = ['pop']

/** How busy the drums are in a bar, within the groove. */
export type BeatPart = 'main' | 'quiet' | 'big' | 'fill' | 'rest'
export const BEAT_PARTS: readonly BeatPart[] = ['main', 'quiet', 'big', 'fill', 'rest']

/** The drums on the beat pad, in the order the home row plays them. */
export type PadDrum = 'kick' | 'snare' | 'clap' | 'rim' | 'hat' | 'openHat' | 'tom' | 'crash'
export const PAD_DRUMS: readonly PadDrum[] = [
  'kick',
  'snare',
  'clap',
  'rim',
  'hat',
  'openHat',
  'tom',
  'crash'
]

/** A drum struck in a beat of your own, `at` beats into the bar (0 is the first beat). */
export interface PadHit {
  drum: PadDrum
  at: number
}

/**
 * A beat the singer made on the pad: every hit in its bar. Numbered as they're made, so
 * "My beat 2" keeps its name.
 */
export interface MyBeat {
  n: number
  /** What the singer called it; unset is "My beat {n}". */
  name?: string
  hits: PadHit[]
}

/** Long enough for "Chorus, double time", short enough to sit on a bar. */
export const BEAT_NAME_MAX_LENGTH = 30

/** What a bar of drums plays: one of the groove's parts, or a beat of your own. */
export type BarBeat = BeatPart | `mine-${number}`

/** The part a bar plays to hear `beat`. */
export const mineOf = (beat: MyBeat): BarBeat => `mine-${beat.n}`

/** A beats track's drums: one groove, what each bar plays, and the beats made for it. */
export interface BeatChart {
  groove: GrooveId
  parts: BarBeat[]
  mine?: MyBeat[]
}

export interface MusicSettings {
  /** 1 is the original speed; 1.1 is 10% faster. */
  speed: number
  /** Whole semitones up (or down, negative) from the original key. */
  semitones: number
  /** Tone of the music, in dB: low shelf (bass) and high shelf (brightness). */
  bassDb: number
  brightnessDb: number
  /** The metronome: heard while playing and recording (with a count-in), never exported. */
  clickOn: boolean
  /** Its volume, 0 to 1. */
  click: number
}

// Long enough for "Chorus harmony (high)", short enough to fit the lane header.
export const TRACK_NAME_MAX_LENGTH = 40

const ROLE_LABEL: Record<TrackRole, string> = {
  vocal: 'Vocal',
  backing: 'Backing',
  // Guitar, piano or beats: to the singer it's all backing, numbered together.
  chords: 'Backing'
}

export function tracksOf(project: Project, role: TrackRole): Track[] {
  return project.tracks.filter((t) => t.role === role)
}

/** Whether two tracks sit together: vocals with vocals, music (files or chords) with music. */
export const sameGroup = (a: TrackRole, b: TrackRole): boolean =>
  (a === 'vocal') === (b === 'vocal')

/**
 * Starting mix by role, so a beginner's first playback already sounds balanced:
 * the lead sits centre, harmonies tuck in quieter and alternate left and right,
 * and mastered backing tracks start lower so the vocal isn't buried.
 */
const MASTERED_MUSIC_VOLUME = 0.5
const HARMONY_VOLUME = 0.7
const HARMONY_PAN = 0.35

/** The volume a track starts at, for its role; double-clicking volume returns here. */
export function startingVolume(role: TrackRole, part?: VocalPart, fromFile = false): number {
  // Music recorded here isn't mastered, so it starts at full volume like a lead.
  if (role === 'backing') return fromFile ? MASTERED_MUSIC_VOLUME : 1
  // The chords are rendered at a level that already sits under a voice.
  if (role === 'chords') return 1
  return part === 'harmony' ? HARMONY_VOLUME : 1
}

/**
 * Whether Rove may set the music's volume to suit a take on this track: a lead vocal,
 * over imported music nobody has turned up or down yet. Once the singer (or Rove) sets
 * it, it stays theirs.
 */
export function canBalanceMusic(project: Project, vocalTrackId: string): boolean {
  const vocal = project.tracks.find((t) => t.id === vocalTrackId)
  if (vocal?.role !== 'vocal' || vocal.part === 'harmony') return false
  const music = project.tracks.filter((t) => t.role === 'backing')
  const untouched = startingVolume('backing', undefined, true)
  return music.length > 0 && music.every((t) => !!t.sourceName && t.volume === untouched)
}

/**
 * Whether Rove may offer to set this harmony's volume against the lead: only while it's
 * where it started. Once the singer (or Rove) sets it, it stays theirs.
 */
export function canBalanceHarmony(project: Project, trackId: string): boolean {
  const track = project.tracks.find((t) => t.id === trackId)
  return (
    track?.role === 'vocal' &&
    track.part === 'harmony' &&
    track.volume === startingVolume('vocal', 'harmony')
  )
}

/** Sets every music file's volume (the backing tracks). */
export const withMusicVolume = (project: Project, volume: number): Project => ({
  ...project,
  tracks: project.tracks.map((t) => (t.role === 'backing' ? { ...t, volume } : t))
})

export function defaultMix(
  project: Project,
  role: TrackRole,
  part?: VocalPart,
  fromFile = false
): { volume: number; pan: number } {
  const volume = startingVolume(role, part, fromFile)
  if (role !== 'vocal' || part !== 'harmony') return { volume, pan: 0 }
  const harmonies = project.tracks.filter((t) => t.part === 'harmony').length
  return { volume, pan: harmonies % 2 === 0 ? -HARMONY_PAN : HARMONY_PAN }
}

/** Adds an empty track named after the next free number for its role ("Vocal 3"). */
export function withNewTrack(
  project: Project,
  role: TrackRole,
  opts: { sourceName?: string; part?: VocalPart } = {}
): { project: Project; track: Track } {
  const label = ROLE_LABEL[role]
  const used = project.tracks.map((t) =>
    Number(new RegExp(`^${label} (\\d+)$`).exec(t.name)?.[1] ?? 0)
  )
  const part = role === 'vocal' ? (opts.part ?? 'lead') : undefined
  const track: Track = {
    id: crypto.randomUUID(),
    role,
    ...(part ? { part } : {}),
    name: `${label} ${Math.max(0, ...used) + 1}`,
    ...(opts.sourceName ? { sourceName: opts.sourceName } : {}),
    ...defaultMix(project, role, part, !!opts.sourceName),
    ...(part ? { polish: defaultPolish(part) } : {}),
    muted: false,
    clips: []
  }
  return { project: { ...project, tracks: [...project.tracks, track] }, track }
}

/**
 * Takes a track out of the song. Its recordings stay in the song folder, so undo can
 * bring it back whole.
 */
export function withoutTracks(project: Project, trackIds: string[]): Project {
  return { ...project, tracks: project.tracks.filter((t) => !trackIds.includes(t.id)) }
}

/** The song with a track renamed; a blank name leaves it as it was. */
export function withTrackName(project: Project, trackId: string, name: string): Project {
  const trimmed = name.trim().slice(0, TRACK_NAME_MAX_LENGTH)
  if (!trimmed) return project
  return {
    ...project,
    tracks: project.tracks.map((t) => (t.id === trackId ? { ...t, name: trimmed } : t))
  }
}

/**
 * The song with a track moved to place `to` among the tracks of its own kind. Vocals and
 * backing tracks are listed in separate groups, so each keeps to its own.
 */
export function moveTrack(project: Project, trackId: string, to: number): Project {
  const track = project.tracks.find((t) => t.id === trackId)
  if (!track) return project
  const inGroup = (t: Track): boolean => sameGroup(t.role, track.role)
  const group = project.tracks.filter(inGroup)
  const reordered = moveItem(group, group.indexOf(track), to)
  let next = 0
  return {
    ...project,
    tracks: project.tracks.map((t) => (inGroup(t) ? reordered[next++] : t))
  }
}

export function polishOf(track: Track): PolishSettings {
  // A control added in a later version starts at its default on songs saved before it.
  return { ...defaultPolish(track.part ?? 'lead'), ...track.polish }
}

export function withLyrics(project: Project, lyrics: SongLyrics | null): Project {
  return { ...project, lyrics }
}

/** Furthest the lyrics can be nudged either way: more than a long intro. */
export const LYRICS_OFFSET_MAX_SEC = 60

/** Moves every lyric line `bySec` later (negative: earlier), within a sensible range. */
export function nudgeLyrics(project: Project, bySec: number): Project {
  if (!project.lyrics) return project
  const offsetSec = Math.max(
    -LYRICS_OFFSET_MAX_SEC,
    Math.min(LYRICS_OFFSET_MAX_SEC, project.lyrics.offsetSec + bySec)
  )
  return { ...project, lyrics: { ...project.lyrics, offsetSec } }
}

export function withTrackPolish(
  project: Project,
  trackId: string,
  polish: PolishSettings
): Project {
  return {
    ...project,
    tracks: project.tracks.map((t) => (t.id === trackId ? { ...t, polish } : t))
  }
}

export function withTrackChanges(
  project: Project,
  trackId: string,
  changes: Partial<Pick<Track, 'volume' | 'pan' | 'muted' | 'part'>>
): Project {
  return {
    ...project,
    tracks: project.tracks.map((t) => {
      if (t.id !== trackId) return t
      const next = { ...t, ...changes }
      // A suggestion was made for one part; the other part sits differently in the mix.
      if (changes.part && changes.part !== (t.part ?? 'lead')) delete next.polishSuggestion
      return next
    })
  }
}

/**
 * Makes a vocal track a lead or a harmony. Volume, pan and Polish the singer hasn't
 * changed move to the new part's starting settings; anything they set stays theirs.
 */
export function withVocalPart(project: Project, trackId: string, part: VocalPart): Project {
  const track = project.tracks.find((t) => t.id === trackId)
  if (track?.role !== 'vocal') return project
  const was = track.part ?? 'lead'
  if (was === part) return project
  const others = { ...project, tracks: project.tracks.filter((t) => t.id !== trackId) }
  const fresh = defaultMix(others, 'vocal', part)
  const untouched = defaultMix(others, 'vocal', was)
  const samePolish = JSON.stringify(polishOf(track)) === JSON.stringify(defaultPolish(was))
  const changed = withTrackChanges(project, trackId, {
    part,
    ...(track.volume === untouched.volume ? { volume: fresh.volume } : {}),
    // A harmony's pan alternates sides, so any starting side counts as untouched.
    ...(Math.abs(track.pan) === Math.abs(untouched.pan) ? { pan: fresh.pan } : {})
  })
  return samePolish ? withTrackPolish(changed, trackId, defaultPolish(part)) : changed
}

const clipEnd = (c: Clip): number => c.start + c.duration

/**
 * Lays a new clip over a track like punching in on tape: whatever it covers is
 * trimmed away (or split around it), everything outside it is kept. Source
 * files are never touched; only the clip windows into them change.
 */
export function insertClip(clips: Clip[], added: Clip): Clip[] {
  const from = added.start
  const to = clipEnd(added)
  const kept: Clip[] = []
  for (const c of clips) {
    const s = c.start
    const e = clipEnd(c)
    if (e <= from || s >= to) {
      kept.push(c)
    } else if (s < from && e > to) {
      kept.push({ ...c, duration: from - s })
      kept.push({
        ...c,
        id: crypto.randomUUID(),
        start: to,
        offset: c.offset + (to - s),
        duration: e - to
      })
    } else if (s < from) {
      kept.push({ ...c, duration: from - s })
    } else if (e > to) {
      kept.push({ ...c, start: to, offset: c.offset + (to - s), duration: e - to })
    }
    // Otherwise the new clip covers it completely and it drops out.
  }
  return [...kept, added].sort((a, b) => a.start - b.start)
}

export function withRecordedClip(
  project: Project,
  trackId: string,
  take: Omit<Clip, 'id'> & { id?: string }
): Project {
  const clip: Clip = { ...take, id: take.id ?? crypto.randomUUID() }
  return {
    ...project,
    tracks: project.tracks.map((t) =>
      t.id === trackId ? { ...t, clips: insertClip(t.clips, clip) } : t
    )
  }
}

/** Replaces a track's audio with one file from the top of the song (backing imports). */
export function withTrackAudio(
  project: Project,
  trackId: string,
  file: string,
  duration: number,
  start = 0
): Project {
  const clip: Clip = { id: crypto.randomUUID(), file, start, offset: 0, duration }
  return {
    ...project,
    tracks: project.tracks.map((t) => (t.id === trackId ? { ...t, clips: [clip] } : t))
  }
}

export function createProject(
  name: string,
  sampleRate: number,
  artist?: string,
  note?: string
): Project {
  const trimmed = artist?.trim()
  const trimmedNote = note?.trim()
  const base: Project = { version: 2, name, sampleRate, tracks: [] }
  if (trimmed) base.artist = trimmed
  if (trimmedNote) base.note = trimmedNote
  return withNewTrack(base, 'vocal').project
}

// --- Clip editing. Every edit changes only clip windows; audio files are untouched.

/** Shortest clip an edit may leave behind, so a clip never vanishes by accident. */
export const MIN_CLIP_SEC = 0.05

function mapClip(
  project: Project,
  trackId: string,
  clipId: string,
  change: (clip: Clip, track: Track) => Clip[]
): Project {
  return {
    ...project,
    tracks: project.tracks.map((t) =>
      t.id !== trackId
        ? t
        : {
            ...t,
            clips: t.clips
              .flatMap((c) => (c.id === clipId ? change(c, t) : [c]))
              .sort((a, b) => a.start - b.start)
          }
    )
  }
}

export function findClip(project: Project, trackId: string, clipId: string): Clip | undefined {
  return project.tracks.find((t) => t.id === trackId)?.clips.find((c) => c.id === clipId)
}

/** Slides a clip along its track. Whatever it lands on is punched out, as with recording. */
export function moveClip(
  project: Project,
  trackId: string,
  clipId: string,
  start: number
): Project {
  const clip = findClip(project, trackId, clipId)
  if (!clip) return project
  const moved = { ...clip, start: Math.max(0, start) }
  return {
    ...project,
    tracks: project.tracks.map((t) =>
      t.id === trackId
        ? {
            ...t,
            clips: insertClip(
              t.clips.filter((c) => c.id !== clipId),
              moved
            )
          }
        : t
    )
  }
}

/** Moves a clip's left edge, revealing or hiding audio while the rest stays in place. */
export function trimClipStart(
  project: Project,
  trackId: string,
  clipId: string,
  start: number
): Project {
  return mapClip(project, trackId, clipId, (c) => {
    const end = c.start + c.duration
    // Can't reveal audio from before the file begins, or cross the right edge.
    const earliest = Math.max(0, c.start - c.offset)
    const s = Math.min(Math.max(start, earliest), end - MIN_CLIP_SEC)
    const shift = s - c.start
    return [{ ...c, start: s, offset: c.offset + shift, duration: c.duration - shift }]
  })
}

/**
 * Slides a clip `bySec` earlier (later when negative) so it sits in time with the music.
 * Unlike a drag, a part that would land before the song starts is trimmed off, so the
 * rest keeps its timing.
 */
export function lineUpClip(
  project: Project,
  trackId: string,
  clipId: string,
  bySec: number
): Project {
  const clip = findClip(project, trackId, clipId)
  if (!clip) return project
  const start = clip.start - bySec
  if (start >= 0) return moveClip(project, trackId, clipId, start)
  return mapClip(project, trackId, clipId, (c) => [
    { ...c, start: 0, offset: c.offset - start, duration: Math.max(0, c.duration + start) }
  ])
}

/**
 * Brings a harmony in time with the lead phrase by phrase: cuts the clip halfway through
 * each pause and slides each piece `bySec` earlier (later when negative). `phrases` are
 * in seconds from the clip's start, in order. The pieces stay one group, so the take
 * still moves as one. Where two pieces would meet, the later one gives up the quiet at
 * its start; as with lining up, what would land before the song starts is trimmed off.
 */
export function syncPhrases(
  project: Project,
  trackId: string,
  clipId: string,
  phrases: { from: number; to: number; bySec: number }[]
): Project {
  const clip = findClip(project, trackId, clipId)
  if (!clip || phrases.length === 0) return project
  const group = phrases.length > 1 ? (clip.group ?? crypto.randomUUID()) : clip.group
  const cuts = phrases.slice(1).map((p, i) => (phrases[i].to + p.from) / 2)
  const edges = [0, ...cuts, clip.duration]
  const pieces: Clip[] = []
  let earliest = 0
  phrases.forEach((p, i) => {
    let from = edges[i]
    let start = clip.start + from - p.bySec
    if (start < earliest) {
      from += earliest - start
      start = earliest
    }
    const duration = edges[i + 1] - from
    if (duration < MIN_CLIP_SEC) return
    pieces.push({
      ...clip,
      id: i === 0 ? clip.id : crypto.randomUUID(),
      start,
      offset: clip.offset + from,
      duration,
      fadeIn: i === 0 ? clip.fadeIn : 0,
      fadeOut: i === phrases.length - 1 ? clip.fadeOut : 0,
      ...(group ? { group } : {})
    })
    earliest = start + duration
  })
  return {
    ...project,
    tracks: project.tracks.map((t) =>
      t.id === trackId
        ? {
            ...t,
            clips: pieces.reduce(
              insertClip,
              t.clips.filter((c) => c.id !== clipId)
            )
          }
        : t
    )
  }
}

/** Moves a clip's right edge, up to the end of its audio file. */
export function trimClipEnd(
  project: Project,
  trackId: string,
  clipId: string,
  end: number,
  fileDuration: number
): Project {
  return mapClip(project, trackId, clipId, (c) => {
    const latest = c.start + (fileDuration - c.offset)
    const e = Math.max(Math.min(end, latest), c.start + MIN_CLIP_SEC)
    return [{ ...c, duration: e - c.start }]
  })
}

export function setClipFades(
  project: Project,
  trackId: string,
  clipId: string,
  fades: { fadeIn?: number; fadeOut?: number }
): Project {
  return mapClip(project, trackId, clipId, (c) => {
    const clamp = (v: number | undefined, fallback: number | undefined): number =>
      Math.max(0, Math.min(c.duration, v ?? fallback ?? 0))
    return [
      { ...c, fadeIn: clamp(fades.fadeIn, c.fadeIn), fadeOut: clamp(fades.fadeOut, c.fadeOut) }
    ]
  })
}

/** Cuts a clip in two at a timeline position. Fades stay on the outer ends. */
export function splitClip(project: Project, trackId: string, clipId: string, at: number): Project {
  return mapClip(project, trackId, clipId, (c) => {
    const into = at - c.start
    if (into < MIN_CLIP_SEC || c.duration - into < MIN_CLIP_SEC) return [c]
    return [
      { ...c, duration: into, fadeOut: 0 },
      {
        ...c,
        id: crypto.randomUUID(),
        start: at,
        offset: c.offset + into,
        duration: c.duration - into,
        fadeIn: 0
      }
    ]
  })
}

export function deleteClip(project: Project, trackId: string, clipId: string): Project {
  return mapClip(project, trackId, clipId, () => [])
}

export function parseProject(data: unknown): Project {
  const p = data as { version?: unknown; name?: unknown; tracks?: unknown; artist?: unknown } | null
  if (!p || p.version !== 2 || typeof p.name !== 'string' || !Array.isArray(p.tracks)) {
    throw new Error(t('song.notRoveProject'))
  }
  const project = p as Project
  // Only keep an artist field that's actually a non-empty string.
  if (typeof project.artist !== 'string' || !project.artist.trim()) delete project.artist
  return withReadableMusic(project)
}

export function formatDuration(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

/** The transport timer: minutes always two digits, so the readout doesn't shift as it plays. */
export function formatClock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds))
  return `${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`
}

const MS_PER_SEC = 1000
const MS_DIGITS = 3

/** The milliseconds after the timer's seconds: ".345". */
export function formatMillis(seconds: number): string {
  // Rounded to a microsecond first, so 0.07 doesn't come out as .069.
  const ms = Math.floor(Math.round(Math.max(0, seconds) * MS_PER_SEC * MS_PER_SEC) / MS_PER_SEC)
  return `.${String(ms % MS_PER_SEC).padStart(MS_DIGITS, '0')}`
}

// --- Music speed and key. These apply to backing tracks only: vocals are sung to
// the music as it plays, so they keep their own speed and pitch.

/** Beyond about a third faster or slower, stretched music starts to sound processed. */
export const MUSIC_SPEED_RANGE = { min: 0.7, max: 1.3 }
/** Half an octave either way covers moving a song into any singer's range. */
export const MUSIC_SEMITONES_MAX = 6

/** Beyond this either way, a shelf starts to sound like a different recording. */
export const MUSIC_TONE_MAX_DB = 6

const ORIGINAL_MUSIC: MusicSettings = {
  speed: 1,
  semitones: 0,
  bassDb: 0,
  brightnessDb: 0,
  clickOn: false,
  // Loud enough to hear over the music, not so loud it covers the voice.
  click: 0.7
}
// Clip times are rescaled on every speed change; rounding keeps them from drifting.
const TIME_PRECISION = 1e6
const roundTime = (sec: number): number => Math.round(sec * TIME_PRECISION) / TIME_PRECISION

// Settings the song hasn't changed play as recorded.
export const musicOf = (project: Project): MusicSettings => ({
  ...ORIGINAL_MUSIC,
  ...project.music
})

const clampTone = (db: number): number =>
  Math.max(-MUSIC_TONE_MAX_DB, Math.min(MUSIC_TONE_MAX_DB, db))

/** Changes the music's bass or brightness. */
export function withMusicTone(
  project: Project,
  tone: Partial<Pick<MusicSettings, 'bassDb' | 'brightnessDb'>>
): Project {
  const music = musicOf(project)
  return {
    ...project,
    music: {
      ...music,
      bassDb: clampTone(tone.bassDb ?? music.bassDb),
      brightnessDb: clampTone(tone.brightnessDb ?? music.brightnessDb)
    }
  }
}

export function withClickOn(project: Project, clickOn: boolean): Project {
  return { ...project, music: { ...musicOf(project), clickOn } }
}

export function withClick(project: Project, level: number): Project {
  return { ...project, music: { ...musicOf(project), click: Math.max(0, Math.min(1, level)) } }
}

/**
 * Plays the music faster or slower. Its clips are measured in time as played, so they
 * shrink or grow with it (their audio is the sped-up copy); vocals stay put.
 */
export function withMusicSpeed(project: Project, speed: number): Project {
  const music = musicOf(project)
  const next = Math.max(MUSIC_SPEED_RANGE.min, Math.min(MUSIC_SPEED_RANGE.max, speed))
  const scale = (sec: number): number => roundTime((sec * music.speed) / next)
  return {
    ...project,
    music: { ...music, speed: next },
    tracks: project.tracks.map((t) =>
      t.role !== 'backing'
        ? t
        : {
            ...t,
            clips: t.clips.map((c) => ({
              ...c,
              start: scale(c.start),
              offset: scale(c.offset),
              duration: scale(c.duration),
              ...(c.fadeIn ? { fadeIn: scale(c.fadeIn) } : {}),
              ...(c.fadeOut ? { fadeOut: scale(c.fadeOut) } : {})
            }))
          }
    )
  }
}

/** Moves the music to a new key; the song key that tuning pulls toward moves with it. */
export function withMusicPitch(project: Project, semitones: number): Project {
  const music = musicOf(project)
  const next = Math.round(Math.max(-MUSIC_SEMITONES_MAX, Math.min(MUSIC_SEMITONES_MAX, semitones)))
  const shift = next - music.semitones
  const key = project.key && transposeKey(project.key, shift)
  return { ...project, key, music: { ...music, semitones: next } }
}

const mapTrack = (project: Project, trackId: string, change: (track: Track) => Track): Project => ({
  ...project,
  tracks: project.tracks.map((track) => (track.id === trackId ? change(track) : track))
})

/** The backing track plays instrumentals in place of its songs, keeping the songs for later. */
export function withoutVocals(
  project: Project,
  trackId: string,
  instrumentals: Record<string, string>
): Project {
  return mapTrack(project, trackId, (track) => ({
    ...track,
    clips: track.clips.map((clip) =>
      clip.file in instrumentals
        ? { ...clip, file: instrumentals[clip.file], withVocals: clip.file }
        : clip
    )
  }))
}

/** The backing track plays its original songs again. */
export function withVocalsBack(project: Project, trackId: string): Project {
  return mapTrack(project, trackId, (track) => ({
    ...track,
    clips: track.clips.map(({ withVocals, ...clip }) =>
      withVocals ? { ...clip, file: withVocals } : clip
    )
  }))
}

/** Every clip of the track plays an instrumental made from its song. */
export const vocalsRemoved = (track: Track): boolean =>
  track.clips.length > 0 && track.clips.every((clip) => clip.withVocals !== undefined)

// --- The chord chart, and the chords track that plays it.

/** Slow ballads to fast punk: a tempo outside this is almost certainly a typo. */
export const CHART_BPM_RANGE = { min: 40, max: 240 }
/** A comfortable middle tempo to start a new chart from. */
export const DEFAULT_CHART_BPM = 100
/** Far more than any song needs; keeps a stray paste from making a huge chart. */
export const CHART_MAX_BARS = 500
/** A new chart starts with one line of bars, ready to fill in. */
const NEW_CHART_BARS = 4

function isChart(value: unknown): value is ChordChart {
  if (!value || typeof value !== 'object') return false
  const c = value as Partial<ChordChart>
  const isChord = (x: unknown): boolean => {
    const chord = x as Partial<Chord> | null
    return !!chord && typeof chord.root === 'number' && typeof chord.quality === 'string'
  }
  return (
    Array.isArray(c.bars) &&
    c.bars.every((bar) => Array.isArray(bar) && bar.every(isChord)) &&
    (c.feels === undefined ||
      (Array.isArray(c.feels) && c.feels.every((f) => CHORD_FEELS.includes(f))))
  )
}

const isPadHit = (value: unknown): value is PadHit => {
  const hit = value as Partial<PadHit> | null
  return (
    !!hit &&
    PAD_DRUMS.includes(hit.drum as PadDrum) &&
    typeof hit.at === 'number' &&
    Number.isFinite(hit.at) &&
    hit.at >= 0
  )
}

/** A beat of your own as saved, or null when it can't be read. */
function readMyBeat(value: unknown): MyBeat | null {
  const beat = value as Partial<MyBeat> | null
  if (!beat || !Number.isInteger(beat.n)) return null
  if (beat.name !== undefined && typeof beat.name !== 'string') return null
  if (!Array.isArray(beat.hits) || !beat.hits.every(isPadHit)) return null
  const named = beat.name === undefined ? {} : { name: beat.name }
  return { n: beat.n!, ...named, hits: beat.hits }
}

/** Drums as saved, or null when they can't be read. */
function readBeatChart(value: unknown): BeatChart | null {
  const b = value as Partial<BeatChart> | null
  if (!b || !GROOVE_IDS.includes(b.groove as GrooveId) || !Array.isArray(b.parts)) return null
  if (b.mine !== undefined && !Array.isArray(b.mine)) return null
  const mine = (b.mine ?? []).map(readMyBeat)
  if (mine.some((m) => m === null)) return null
  const known = new Set((mine as MyBeat[]).map(mineOf))
  if (!b.parts.every((p) => BEAT_PARTS.includes(p as BeatPart) || known.has(p))) return null
  const chart: BeatChart = { groove: b.groove!, parts: b.parts }
  return b.mine === undefined ? chart : { ...chart, mine: mine as MyBeat[] }
}

function isTempo(value: unknown): value is SongTempo {
  const t = value as Partial<SongTempo> | null
  return (
    !!t &&
    typeof t.bpm === 'number' &&
    (t.beatsPerBar === 3 || t.beatsPerBar === 4) &&
    typeof t.startSec === 'number'
  )
}

/**
 * The song's tempo and each chords track's chart, instrument and drums, as saved. A part
 * Rove can't read is dropped rather than played wrong.
 */
function withReadableMusic(project: Project): Project {
  const updated: Project = { ...project }
  if (!isTempo(updated.tempo)) delete updated.tempo
  return {
    ...updated,
    tracks: project.tracks.map((track) => {
      if (track.role !== 'chords') return track
      const plain = { ...track }
      if (!isChart(plain.chart)) delete plain.chart
      if (!INSTRUMENTS.includes(plain.instrument as Instrument) || plain.instrument === 'guitar')
        delete plain.instrument
      const beats = readBeatChart(plain.beats)
      if (beats) plain.beats = beats
      else delete plain.beats
      // Drums without bars to play fall back to the guitar.
      if (plain.instrument === 'beats' && !plain.beats) delete plain.instrument
      return plain
    })
  }
}

/** The tracks that play chords the singer wrote. */
export const chordsTracksOf = (project: Project): Track[] => tracksOf(project, 'chords')

/**
 * Adds a chords track with a chart to fill in: one bar of `first`, then bars that carry
 * it on. It keeps time with the song's other chords, so new parts line up with them.
 */
export function withChordBacking(
  project: Project,
  first: Chord,
  /** The music's beat, when Rove has heard it: a first instrumental starts in step. */
  heard?: { bpm: number; startSec: number } | null
): { project: Project; track: Track } {
  const chart: ChordChart = {
    bars: [[first], ...Array.from({ length: NEW_CHART_BARS - 1 }, () => [])]
  }
  const timed = project.tempo
    ? project
    : { ...project, tempo: tempoFrom({ ...DEFAULT_TEMPO, ...heard }) }
  const { project: added, track } = withNewTrack(timed, 'chords')
  const withChart = { ...track, chart }
  return {
    project: { ...added, tracks: added.tracks.map((t) => (t.id === track.id ? withChart : t)) },
    track: withChart
  }
}

const mapChart = (
  project: Project,
  trackId: string,
  change: (chart: ChordChart) => ChordChart
): Project => ({
  ...project,
  tracks: project.tracks.map((t) =>
    t.id === trackId && t.chart ? { ...t, chart: change(t.chart) } : t
  )
})

/** What plays a chords track's part. */
export const instrumentOf = (track: Track): Instrument => track.instrument ?? 'guitar'

/**
 * The track played by `instrument`. Each keeps what was written for it, so switching
 * back loses nothing. Drums played for the first time start on the main groove for
 * `bars` bars, enough to run with the song.
 */
export function withInstrument(
  project: Project,
  trackId: string,
  instrument: Instrument,
  bars: number
): Project {
  return {
    ...project,
    tracks: project.tracks.map((t) => {
      if (t.id !== trackId) return t
      const next = { ...t }
      if (instrument === 'guitar') delete next.instrument
      else next.instrument = instrument
      if (instrument === 'beats' && !next.beats) {
        const count = Math.max(NEW_CHART_BARS, Math.min(CHART_MAX_BARS, bars))
        next.beats = { groove: 'pop', parts: Array<BarBeat>(count).fill('main') }
      }
      return next
    })
  }
}

const mapBeats = (
  project: Project,
  trackId: string,
  change: (beats: BeatChart) => BeatChart
): Project => ({
  ...project,
  tracks: project.tracks.map((t) =>
    t.id === trackId && t.beats ? { ...t, beats: change(t.beats) } : t
  )
})

/** The drums with a new part for each bar. */
export const withBeatParts = (project: Project, trackId: string, parts: BarBeat[]): Project =>
  mapBeats(project, trackId, (beats) => ({ ...beats, parts: parts.slice(0, CHART_MAX_BARS) }))

/** A beat of your own, added, or changed when it's already there. */
export const withMyBeat = (project: Project, trackId: string, beat: MyBeat): Project =>
  mapBeats(project, trackId, (beats) => {
    const mine = beats.mine ?? []
    const known = mine.some((b) => b.n === beat.n)
    return {
      ...beats,
      mine: known ? mine.map((b) => (b.n === beat.n ? beat : b)) : [...mine, beat]
    }
  })

/**
 * A beat of your own taken away. The bars that played it move to the beat made before it
 * (or the next one, if it was the first), and to the main groove only when none is left.
 */
export const withoutMyBeat = (project: Project, trackId: string, n: number): Project =>
  mapBeats(project, trackId, (beats) => {
    const mine = beats.mine ?? []
    const at = mine.findIndex((b) => b.n === n)
    const instead = mine[at - 1] ?? mine[at + 1]
    const next: BarBeat = instead ? mineOf(instead) : 'main'
    return {
      ...beats,
      parts: beats.parts.map((p) => (p === `mine-${n}` ? next : p)),
      mine: mine.filter((b) => b.n !== n)
    }
  })

/** Drum bars copied from a track: what each plays, and the beats of your own they use. */
export interface CopiedBeats {
  parts: BarBeat[]
  mine: MyBeat[]
}

/** Bars `first` to `last` of a beats track, ready to paste anywhere. */
export function copyBeats(beats: BeatChart, first: number, last: number): CopiedBeats {
  const parts = beats.parts.slice(first, last + 1)
  return { parts, mine: (beats.mine ?? []).filter((b) => parts.includes(mineOf(b))) }
}

/**
 * Copied drum bars put in at bar `at`. Beats of your own they use come along: one the
 * track already has (same number, same hits) is used as it is, and any other is added as
 * a new beat, so pasting into another track never plays the wrong one.
 */
export const withPastedBeats = (
  project: Project,
  trackId: string,
  at: number,
  copied: CopiedBeats
): Project =>
  mapBeats(project, trackId, (beats) => {
    let mine = beats.mine ?? []
    const renamed = new Map<BarBeat, BarBeat>()
    for (const beat of copied.mine) {
      const same = mine.find(
        (b) => b.n === beat.n && JSON.stringify(b.hits) === JSON.stringify(beat.hits)
      )
      if (same) continue
      const added = { ...beat, n: nextBeatNumber({ ...beats, mine }) }
      mine = [...mine, added]
      renamed.set(mineOf(beat), mineOf(added))
    }
    const parts = copied.parts.map((p) => renamed.get(p) ?? p)
    return {
      ...beats,
      mine,
      parts: [...beats.parts.slice(0, at), ...parts, ...beats.parts.slice(at)].slice(
        0,
        CHART_MAX_BARS
      )
    }
  })

/** The number the next beat you make is called by. */
export const nextBeatNumber = (beats: BeatChart): number =>
  Math.max(0, ...(beats.mine ?? []).map((b) => b.n)) + 1

/** How each bar is played, one per bar: unset ones are strummed. */
export const feelsOf = (chart: ChordChart): ChordFeel[] =>
  chart.bars.map((_, i) => chart.feels?.[i] ?? 'strum')

/**
 * The chart with new bars. A change that moves bars around passes how they're played,
 * moved the same way; otherwise each bar keeps its own.
 */
export function withChartBars(
  project: Project,
  trackId: string,
  bars: Chord[][],
  feels?: ChordFeel[]
): Project {
  return mapChart(project, trackId, (chart) => {
    const kept = bars.slice(0, CHART_MAX_BARS)
    const played = kept.map((_, i) => (feels ?? chart.feels)?.[i] ?? 'strum')
    const next: ChordChart = { ...chart, bars: kept }
    // Only kept when some bar isn't strummed, so all-strummed charts stay as they were.
    if (played.some((f) => f !== 'strum')) next.feels = played
    else delete next.feels
    return next
  })
}

const DEFAULT_TEMPO: SongTempo = { bpm: DEFAULT_CHART_BPM, beatsPerBar: 4, startSec: 0 }

// A tempo heard in music is rarely a whole number, and rounding it off lets the chords
// drift from the music: 92.4 played as 92 is a second behind after three minutes.
const BPM_PRECISION = 100

/** A tempo with its bpm kept in the sensible range, to a hundredth. */
const tempoFrom = (tempo: SongTempo): SongTempo => ({
  bpm:
    Math.round(
      Math.max(CHART_BPM_RANGE.min, Math.min(CHART_BPM_RANGE.max, tempo.bpm)) * BPM_PRECISION
    ) / BPM_PRECISION,
  beatsPerBar: tempo.beatsPerBar,
  startSec: tempo.startSec
})

/** The song's beat: what its instrumentals and their click keep time with. */
export const tempoOf = (project: Project): SongTempo => project.tempo ?? DEFAULT_TEMPO

/** Every instrumental faster or slower together. */
export const withSongTempo = (project: Project, bpm: number): Project => ({
  ...project,
  tempo: tempoFrom({ ...tempoOf(project), bpm })
})

/** Every instrumental on the music's beat: its tempo, with bar 1 on its first beat. */
export const withTempoOfMusic = (
  project: Project,
  heard: { bpm: number; startSec: number }
): Project => ({ ...project, tempo: tempoFrom({ ...tempoOf(project), ...heard }) })

/** Every instrumental in threes or fours together. */
export const withSongBeats = (project: Project, beatsPerBar: BeatsPerBar): Project => ({
  ...project,
  tempo: { ...tempoOf(project), beatsPerBar }
})

/** Every instrumental's bar 1, and the metronome's, at `startSec` (never before the song). */
export const withSongStart = (project: Project, startSec: number): Project => ({
  ...project,
  tempo: { ...tempoOf(project), startSec: Math.max(0, startSec) }
})

/** Bars `first` to `last` played with `feel`. */
export const withChartFeel = (
  project: Project,
  trackId: string,
  first: number,
  last: number,
  feel: ChordFeel
): Project => {
  const chart = project.tracks.find((t) => t.id === trackId)?.chart
  if (!chart) return project
  const feels = feelsOf(chart).map((f, i) => (i >= first && i <= last ? feel : f))
  return withChartBars(project, trackId, chart.bars, feels)
}
