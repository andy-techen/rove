import { useEffect, useState } from 'react'
import { t } from '@shared/copy'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { HelpTip } from '../ui/HelpTip'
import './SettingsDialog.css'

/** App settings: for now, where new songs are saved. */
export function SettingsDialog({ onClose }: { onClose(): void }): React.JSX.Element {
  const [folder, setFolder] = useState<string | null>(null)
  useEffect(() => {
    void window.api.getSongsFolder().then(setFolder)
  }, [])

  const change = async (): Promise<void> => {
    const chosen = await window.api.chooseSongsFolder()
    if (chosen) setFolder(chosen)
  }

  return (
    <Dialog title={t('settings.title')} closeLabel={t('settings.close')} onClose={onClose}>
      <div className="settings">
        <span className="settings-label">
          {t('settings.songsFolder')}
          <HelpTip text={t('settings.songsFolderHint')} />
        </span>
        <div className="settings-folder">
          <span className="settings-path" title={folder ?? undefined}>
            {folder}
          </span>
          <Button size="sm" variant="quiet" onClick={() => void change()}>
            {t('settings.changeFolder')}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
