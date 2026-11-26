import { RELEASES_URL, REPO } from './site'

export interface Download {
  version: string | null
  /** The .dmg for each kind of Mac, or the releases page when it can't be found. */
  appleSilicon: string
  intel: string
}

interface GithubRelease {
  tag_name: string
  assets: { name: string; browser_download_url: string }[]
}

const FALLBACK: Download = { version: null, appleSilicon: RELEASES_URL, intel: RELEASES_URL }

// The .dmg names carry the version (rove-0.2.2-arm64.dmg), so the links are read from
// the latest release when the site is built. The release workflow rebuilds the site
// after publishing, so they stay current. If GitHub can't be reached, the buttons open
// the releases page instead of failing the build.
export async function latestDownload(): Promise<Download> {
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json' }
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers })
    if (!res.ok) throw new Error(`GitHub answered ${res.status}`)
    const release = (await res.json()) as GithubRelease
    const dmg = (arch: string): string =>
      release.assets.find((a) => a.name.endsWith(`-${arch}.dmg`))?.browser_download_url ??
      RELEASES_URL
    return {
      version: release.tag_name.replace(/^v/, ''),
      appleSilicon: dmg('arm64'),
      intel: dmg('x64')
    }
  } catch (error) {
    console.warn(`Couldn't read the latest release; linking to the releases page. ${error}`)
    return FALLBACK
  }
}
