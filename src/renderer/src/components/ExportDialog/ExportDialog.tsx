import { useState } from 'react'
import { t } from '@shared/copy'
import { EXPORT_FORMATS, ExportFormat } from '@shared/exportFormats'
import { ExportLoudness } from '../../audio/export/exportMix'
import { ExportOptions, ExportState } from '../../state/song/useExport'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { HelpTip } from '../ui/HelpTip'
import './ExportDialog.css'

const LOUDNESS: ExportLoudness[] = ['streaming', 'loud', 'asMixed']
const PERCENT = 100

interface Props {
  state: ExportState
  onStart(options: ExportOptions): void
  onReveal(): void
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
export function ExportDialog({ state, onStart, onReveal, onClose }: Props): React.JSX.Element {
  const [format, setFormat] = useState<ExportFormat>('wav')
  const [loudness, setLoudness] = useState<ExportLoudness>('streaming')
  const working = state.status === 'working'
  const status = statusText(state)

  return (
    <Dialog
      title={t('export.title')}
      closeLabel={t('export.cancel')}
      onClose={onClose}
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
      </fieldset>

      <fieldset className="export-choice" disabled={working}>
        <legend>
          {t('export.loudness')} <HelpTip text={t('export.loudnessHelp')} />
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

      <p
        className={state.status === 'failed' ? 'export-status error' : 'export-status'}
        aria-live="polite"
      >
        {status}
      </p>

      <footer className="export-actions">
        {state.status === 'done' ? (
          <>
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
            <Button disabled={working} onClick={() => onStart({ format, loudness })}>
              {t('export.start')}
            </Button>
          </>
        )}
      </footer>
    </Dialog>
  )
}
