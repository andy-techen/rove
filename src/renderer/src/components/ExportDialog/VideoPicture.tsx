import { useState } from 'react'
import { t } from '@shared/copy'
import {
  VIDEO_HEIGHT,
  VIDEO_WIDTH,
  VideoOptions,
  drawVideoFrame
} from '../../audio/export/videoFrame'
import { SongLyrics } from '../../state/lyrics/lyrics'
import { Icon } from '../ui/Icon'
import { PictureEditor } from './PictureEditor'
import { previewTime, sceneFor, useDrawing, usePicture } from './videoHooks'
import { videoSummary } from './videoSummary'

interface Props {
  value: VideoOptions
  onChange(value: VideoOptions): void
  lyrics: SongLyrics | null
}

/**
 * The video's picture in the export dialog: a small preview and a way into the picture
 * editor, where there's room to place words and pick colours.
 */
export function VideoPicture({ value, onChange, lyrics }: Props): React.JSX.Element {
  const picture = usePicture()
  const [editing, setEditing] = useState(false)
  const summary = videoSummary(value)
  const preview = useDrawing(
    (ctx) => drawVideoFrame(ctx, sceneFor(value, picture.image, lyrics), previewTime(lyrics)),
    [value, picture.image, lyrics]
  )

  return (
    <>
      {/* One button: the preview is what the singer means to change, so it opens the editor. */}
      <button
        type="button"
        className="export-video"
        aria-label={t('export.video.edit')}
        onClick={() => setEditing(true)}
      >
        <canvas
          ref={preview}
          className="export-video-preview"
          width={VIDEO_WIDTH}
          height={VIDEO_HEIGHT}
          aria-hidden="true"
        />
        <span className="export-video-label">
          <span className="export-video-name">{summary.title}</span>
          {summary.detail && <span className="export-video-hint">{summary.detail}</span>}
        </span>
        <span className="export-video-edit" aria-hidden="true">
          <Icon name="edit" size="secondary" />
          {t('export.video.editShort')}
        </span>
      </button>
      {editing && (
        <PictureEditor
          value={value}
          onChange={onChange}
          picture={picture}
          lyrics={lyrics}
          onClose={() => setEditing(false)}
        />
      )}
    </>
  )
}
