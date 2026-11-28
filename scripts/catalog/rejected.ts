import { promises as fs } from 'node:fs'

// Songs taken out of the catalog on purpose, so later adds and imports don't bring them
// back. A curator's local notes: kept beside the scripts, never committed or shipped.

export interface Rejection {
  title: string
  artist: string
  isrc: string | null
  reason: string
}

export async function readRejections(file: string): Promise<Rejection[]> {
  const text = await fs.readFile(file, 'utf8').catch(() => null)
  return text === null ? [] : (JSON.parse(text) as Rejection[])
}

export async function saveRejection(file: string, rejection: Rejection): Promise<void> {
  const others = (await readRejections(file)).filter(
    (r) => r.title !== rejection.title || r.artist !== rejection.artist
  )
  await fs.writeFile(file, `${JSON.stringify([...others, rejection], null, 2)}\n`)
}

/** Why this recording, or this title and artist, was taken out; null if it wasn't. */
export function rejectionOf(
  rejections: readonly Rejection[],
  song: Pick<Rejection, 'title' | 'artist' | 'isrc'>
): string | null {
  const match = rejections.find(
    (r) =>
      (r.isrc !== null && r.isrc === song.isrc) ||
      (r.title === song.title && r.artist === song.artist)
  )
  return match?.reason ?? null
}
