export interface ScheduledClip {
  buffer: AudioBuffer
  /** Where the clip's audio goes: its track's mixer chain. */
  output: AudioNode
  /** Timeline position of the clip, in seconds. */
  start: number
  /** Where in the file the clip begins, in seconds. */
  offset: number
  /** How much of the file plays, in seconds. */
  duration: number
  fadeIn?: number
  fadeOut?: number
}

export interface ClipPlan {
  /** Seconds after the transport starts that this clip should begin. */
  delay: number
  offset: number
  duration: number
  /** How far into the clip playback begins (non-zero when starting mid-clip). */
  into: number
}

/** How to play `clip` when the transport starts at timeline position `fromSec`. */
export function planClip(
  clip: Pick<ScheduledClip, 'start' | 'offset' | 'duration'>,
  fromSec: number
): ClipPlan | null {
  const end = clip.start + clip.duration
  if (end <= fromSec || clip.duration <= 0) return null
  if (clip.start >= fromSec) {
    return { delay: clip.start - fromSec, offset: clip.offset, duration: clip.duration, into: 0 }
  }
  const into = fromSec - clip.start
  return { delay: 0, offset: clip.offset + into, duration: clip.duration - into, into }
}

/**
 * Gain breakpoints for a clip's fades, as [seconds after this clip starts sounding,
 * gain] pairs, for playback that begins `into` seconds into the clip. Fades that
 * would overlap are shortened to meet in the middle.
 */
export function fadeEnvelope(
  duration: number,
  fadeIn = 0,
  fadeOut = 0,
  into = 0
): [number, number][] {
  const scale = fadeIn + fadeOut > duration ? duration / (fadeIn + fadeOut) : 1
  const fi = fadeIn * scale
  const fo = fadeOut * scale
  const gainAt = (t: number): number => {
    let g = 1
    if (fi > 0 && t < fi) g = Math.min(g, t / fi)
    if (fo > 0 && t > duration - fo) g = Math.min(g, (duration - t) / fo)
    return Math.max(0, g)
  }
  const breakpoints = [0, fi, duration - fo, duration].filter((t) => t > into)
  return [into, ...breakpoints]
    .filter((t, i, all) => i === 0 || t !== all[i - 1])
    .map((t) => [t - into, gainAt(t)])
}

/** Starts every clip that overlaps `fromSec` onward, aligned to `atTime` on the context clock. */
export function scheduleClips(
  ctx: BaseAudioContext,
  clips: ScheduledClip[],
  fromSec: number,
  atTime: number
): AudioBufferSourceNode[] {
  const nodes: AudioBufferSourceNode[] = []
  for (const clip of clips) {
    const plan = planClip(clip, fromSec)
    if (!plan) continue
    const node = ctx.createBufferSource()
    node.buffer = clip.buffer
    const begin = atTime + plan.delay
    if (clip.fadeIn || clip.fadeOut) {
      const fade = ctx.createGain()
      for (const [t, g] of fadeEnvelope(clip.duration, clip.fadeIn, clip.fadeOut, plan.into)) {
        if (t === 0) fade.gain.setValueAtTime(g, begin)
        else fade.gain.linearRampToValueAtTime(g, begin + t)
      }
      node.connect(fade).connect(clip.output)
      node.onended = null
      node.addEventListener('ended', () => fade.disconnect())
    } else {
      node.connect(clip.output)
    }
    node.start(begin, plan.offset, plan.duration)
    nodes.push(node)
  }
  return nodes
}

/**
 * Stops clips now, or at `atTime` on the audio clock, so a take can pick up from
 * playback on the very frame the old nodes fall silent.
 */
export function stopNodes(nodes: AudioBufferSourceNode[], atTime?: number): void {
  for (const node of nodes) {
    node.onended = null
    if (atTime === undefined) {
      node.stop()
      node.disconnect()
    } else {
      node.stop(atTime)
      node.addEventListener('ended', () => node.disconnect())
    }
  }
}

/** Calls back when every node has finished playing. Never fires for an empty list. */
export function onAllEnded(nodes: AudioBufferSourceNode[], callback: () => void): void {
  let remaining = nodes.length
  for (const node of nodes) {
    node.onended = () => {
      if (--remaining === 0) callback()
    }
  }
}
