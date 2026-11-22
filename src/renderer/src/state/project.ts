export interface Clip {
  id: string
  file: string
  /** Where the clip sits on the timeline, in seconds. */
  start: number
  /** Where inside the file playback begins, in seconds (for trimming later). */
  offset: number
  /** How much of the file plays, in seconds. */
  duration: number
}

export interface Track {
  id: string
  role: 'lead' | 'harmony'
  name: string
  volume: number
  pan: number
  muted: boolean
  clips: Clip[]
}

export interface BackingTrack {
  file: string
  name: string
  volume: number
}

export interface Project {
  version: 1
  name: string
  sampleRate: number
  backingTrack: BackingTrack | null
  tracks: Track[]
}

export function createProject(name: string, sampleRate: number): Project {
  return { version: 1, name, sampleRate, backingTrack: null, tracks: [] }
}

export function parseProject(data: unknown): Project {
  const p = data as Partial<Project> | null
  if (!p || p.version !== 1 || !Array.isArray(p.tracks) || typeof p.name !== 'string') {
    throw new Error("This folder's project.json isn't a Rove project file.")
  }
  return { ...p, backingTrack: p.backingTrack ?? null } as Project
}

export function withBackingTrack(project: Project, file: string, name: string): Project {
  return { ...project, backingTrack: { file, name, volume: 1 } }
}

// Phase 1 keeps every take on the lead track at the top of the song; choosing
// between overlapping takes comes with the multitrack timeline.
export function withTake(project: Project, file: string, duration: number): Project {
  const clip: Clip = { id: crypto.randomUUID(), file, start: 0, offset: 0, duration }
  const lead = project.tracks.find((t) => t.role === 'lead')
  if (!lead) {
    const track: Track = {
      id: crypto.randomUUID(),
      role: 'lead',
      name: 'Lead Vocal',
      volume: 1,
      pan: 0,
      muted: false,
      clips: [clip]
    }
    return { ...project, tracks: [...project.tracks, track] }
  }
  return {
    ...project,
    tracks: project.tracks.map((t) => (t === lead ? { ...t, clips: [...t.clips, clip] } : t))
  }
}

export function leadTakes(project: Project): Clip[] {
  return project.tracks.find((t) => t.role === 'lead')?.clips ?? []
}

export function formatDuration(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}
