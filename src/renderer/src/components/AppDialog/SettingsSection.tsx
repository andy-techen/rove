import { useEffect, useState } from 'react'
import { t } from '@shared/copy'
import { Button } from '../ui/Button'
import { HelpTip } from '../ui/HelpTip'

/** App settings: for now, where new songs are saved. */
export function SettingsSection(): React.JSX.Element {
  const [folder, setFolder] = useState<string | null>(null)
  useEffect(() => {
    void window.api.getSongsFolder().then(setFolder)
  }, [])

  const change = async (): Promise<void> => {
    const chosen = await window.api.chooseSongsFolder()
    if (chosen) setFolder(chosen)
  }

  return (
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
  )
}
