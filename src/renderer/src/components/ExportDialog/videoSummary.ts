import { t } from '@shared/copy'
import type { VideoOptions } from '../../audio/export/videoFrame'

/** What the export dialog says the video's picture holds: its background, and lyrics if on. */
export function videoSummary(video: VideoOptions): { title: string; detail: string | null } {
  const { background } = video
  // The singer's own colour or picture is theirs; it needs no name beyond that.
  const title =
    background.kind === 'blank'
      ? t(`export.video.backgrounds.${background.id}`)
      : t('export.video.summary.custom')
  return { title, detail: video.lyrics ? t('export.video.summary.lyrics') : null }
}
