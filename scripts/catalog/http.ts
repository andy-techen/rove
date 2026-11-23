import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

// MusicBrainz asks for at most one request per second and a User-Agent that names the
// app and a way to reach us: https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting
const MIN_GAP_MS = 1100
/** When it answers 503 (too fast, or busy, which is common), back off up to a minute. */
const RETRY_DELAYS_MS = [2000, 4000, 8000, 16_000, 30_000, 60_000]
const USER_AGENT = 'Rove/0.1 ( https://github.com/andy-techen/rove )'

/**
 * GETs JSON, caching every answer (including "not found") on disk keyed by URL, so
 * re-running a command makes no network calls. `refresh` skips the cache.
 */
export function cachedFetchJson(
  cacheDir: string,
  refresh = false
): (url: string) => Promise<unknown | null> {
  let lastRequestAt = 0

  return async (url) => {
    const file = join(cacheDir, `${createHash('sha1').update(url).digest('hex')}.json`)
    if (!refresh) {
      const cached = await fs.readFile(file, 'utf8').catch(() => null)
      if (cached !== null) return JSON.parse(cached) as unknown
    }

    for (let attempt = 0; ; attempt++) {
      const wait = lastRequestAt + MIN_GAP_MS - Date.now()
      if (wait > 0) await sleep(wait)
      lastRequestAt = Date.now()
      const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }
      })
      if (response.status === 503 && attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt])
        continue
      }
      if (response.status !== 404 && !response.ok) {
        throw new Error(`${response.status} ${response.statusText} from ${url}`)
      }
      const body: unknown = response.status === 404 ? null : await response.json()
      await fs.mkdir(cacheDir, { recursive: true })
      await fs.writeFile(file, JSON.stringify(body))
      return body
    }
  }
}
