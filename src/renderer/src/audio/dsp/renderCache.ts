// Changed copies of recordings (tuned vocals, music at a new speed or key), made once
// and remembered. The recordings themselves are never touched.

// The last few versions of each recording, so moving a slider back and forth is instant
// without holding every version ever made (each is a full copy of the audio).
const KEEP_VERSIONS = 3

const versions = new WeakMap<AudioBuffer, Map<string, Promise<AudioBuffer>>>()

/** Whether this version of a recording is already made (or being made). */
export const hasRender = (buffer: AudioBuffer, key: string): boolean =>
  !!versions.get(buffer)?.has(key)

/** A version of a recording, made by `render` the first time it's asked for. */
export function cachedRender(
  buffer: AudioBuffer,
  key: string,
  render: () => Promise<AudioBuffer>
): Promise<AudioBuffer> {
  let byKey = versions.get(buffer)
  if (!byKey) versions.set(buffer, (byKey = new Map()))
  const cached = byKey.get(key)
  if (cached) return cached
  const result = render()
  byKey.set(key, result)
  // A failed render is forgotten, so asking again tries again.
  result.catch(() => byKey.get(key) === result && byKey.delete(key))
  if (byKey.size > KEEP_VERSIONS) byKey.delete(byKey.keys().next().value as string)
  return result
}

export function bufferOf(channels: Float32Array<ArrayBuffer>[], sampleRate: number): AudioBuffer {
  const out = new AudioBuffer({
    length: channels[0]?.length ?? 0,
    sampleRate,
    numberOfChannels: channels.length
  })
  channels.forEach((channel, ch) => out.copyToChannel(channel, ch))
  return out
}

export const channelsOf = (buffer: AudioBuffer): Float32Array[] =>
  Array.from({ length: buffer.numberOfChannels }, (_, ch) => buffer.getChannelData(ch))
