import { PERCENT } from '@shared/units'
import { useState } from 'react'
import { t } from '@shared/copy'
import { EXPORT_FORMATS, ExportFormat } from '@shared/exportFormats'
import { ExportLoudness } from '../../audio/export/exportMix'
import { DEFAULT_LYRICS_STYLE, VideoOptions } from '../../audio/export/videoFrame'
import { SongLyrics } from '../../state/lyrics/lyrics'
import { ExportOptions, ExportState } from '../../state/song/useExport'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { HelpTip } from '../ui/HelpTip'
import { VideoPicture } from './VideoPicture'
import './ExportDialog.css'

const LOUDNESS: ExportLoudness[] = ['streaming', 'asMixed']
// Besides the mix, the whole song can go out as a Rove project file.
type ExportChoice = ExportFormat | 'project'
// A video starts plain: the warmest background, no words and no lyrics, until the singer adds them.
const DEFAULT_VIDEO: VideoOptions = {
  background: { kind: 'blank', id: 'goldenHour' },
  texts: [],
  lyrics: false,
  lyricsStyle: DEFAULT_LYRICS_STYLE
}

interface Props {
  state: ExportState
  /** The song's lyrics, which a video can show as they're sung. */
  lyrics: SongLyrics | null
  onStart(options: ExportOptions): void
  onReveal(): void
  onShare(): void
  /** Saves the whole song as one .rove project file, when that's the format chosen. */
  onExportProject(): void
  onClose(): void
}

function statusText(state: ExportState): string | null {
  if (state.status === 'failed') return t('export.failed')
  if (state.status === 'done') {
    return t('export.done', { file: state.filePath.split(/[\\/]/).pop() ?? state.filePath })
  }
  if (state.status !== 'working') return null
  const { stage } = state
  if (stage.stage === 'encoding') {
    return t('export.stages.encoding', { percent: Math.round(stage.progress * PERCENT) })
  }
  return t(`export.stages.${stage.stage}`)
}

/** Choose a format and loudness, then export the song's mix to a file. */
export function ExportDialog({
  state,
  lyrics,
  onStart,
  onReveal,
  onShare,
  onExportProject,
  onClose
}: Props): React.JSX.Element {
  const [format, setFormat] = useState<ExportChoice>('wav')
  const [loudness, setLoudness] = useState<ExportLoudness>('streaming')
  const [video, setVideo] = useState<VideoOptions>(DEFAULT_VIDEO)
  const working = state.status === 'working'
  const status = statusText(state)

  return (
    <Dialog
      title={t('export.title')}
      closeLabel={t('export.cancel')}
      onClose={onClose}
      sizeKey="export"
      className="export-dialog"
    >
      <fieldset className="export-choice" disabled={working}>
        <legend>{t('export.format')}</legend>
        {EXPORT_FORMATS.map((f) => (
          <label key={f} className="export-option">
            <input
              type="radio"
              name="export-format"
              checked={format === f}
              onChange={() => setFormat(f)}
            />
            <span className="export-option-name">{t(`export.formats.${f}`)}</span>
            <span className="export-option-hint">{t(`export.formatHints.${f}`)}</span>
          </label>
        ))}
        <label className="export-option">
          <input
            type="radio"
            name="export-format"
            checked={format === 'project'}
            onChange={() => setFormat('project')}
          />
          <span className="export-option-name">{t('songFile.formatName')}</span>
          <span className="export-option-hint">{t('songFile.formatHint')}</span>
        </label>
      </fieldset>

      {format === 'mp4' && (
        <fieldset className="export-choice" disabled={working}>
          <legend>{t('export.video.picture')}</legend>
          <VideoPicture value={video} onChange={setVideo} lyrics={lyrics} />
        </fieldset>
      )}

      {format !== 'project' && (
        <fieldset className="export-choice" disabled={working}>
          <legend>
            {t('export.loudness')}{' '}
            <HelpTip
              items={LOUDNESS.map((l) => ({
                term: t(`export.loudnessOptions.${l}`),
                text: t(`export.loudnessHelp.${l}`)
              }))}
            />
          </legend>
          {LOUDNESS.map((l) => (
            <label key={l} className="export-option">
              <input
                type="radio"
                name="export-loudness"
                checked={loudness === l}
                onChange={() => setLoudness(l)}
              />
              <span className="export-option-name">{t(`export.loudnessOptions.${l}`)}</span>
            </label>
          ))}
        </fieldset>
      )}

      <p
        className={state.status === 'failed' ? 'export-status error' : 'export-status'}
        aria-live="polite"
      >
        {status}
      </p>

      <footer className="export-actions">
        {state.status === 'done' ? (
          <>
            <HelpTip text={t('export.shareHelp')} />
            <Button variant="secondary" onClick={onShare}>
              {t('export.share')}
            </Button>
            <Button variant="secondary" onClick={onReveal}>
              {t('export.reveal')}
            </Button>
            <Button onClick={onClose}>{t('export.close')}</Button>
          </>
        ) : (
          <>
            <Button variant="quiet" onClick={onClose}>
              {t('export.cancel')}
            </Button>
            <Button
              disabled={working}
              onClick={() =>
                format === 'project'
                  ? onExportProject()
                  : onStart(format === 'mp4' ? { format, loudness, video } : { format, loudness })
              }
            >
              {t('export.start')}
            </Button>
          </>
        )}
      </footer>
    </Dialog>
  )
}
