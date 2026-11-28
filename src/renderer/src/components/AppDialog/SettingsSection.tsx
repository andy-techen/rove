import { useEffect, useState } from 'react'
import { t } from '@shared/copy'
import { TEXT_SIZES, THEMES } from '@shared/preferences/appearance'
import { useTextSize, useTheme } from '../../state/ui/colorScheme'
import { Button } from '../ui/Button'
import { HelpTip } from '../ui/HelpTip'
import { Segmented } from '../ui/Segmented'

const THEME_OPTIONS = THEMES.map((value) => ({ value, label: t(`menu.themes.${value}`) }))
const TEXT_SIZE_OPTIONS = TEXT_SIZES.map((value) => ({
  value,
  label: t(`settings.textSizes.${value}`)
}))

interface FolderProps {
  label: string
  hint: string
  /** The Change button's accessible name, saying which folder. */
  changeLabel: string
  load(): Promise<string>
  choose(): Promise<string | null>
}

/** A folder Rove saves into, with a button to pick another. */
function FolderSetting({ label, hint, changeLabel, load, choose }: FolderProps): React.JSX.Element {
  const [folder, setFolder] = useState<string | null>(null)
  useEffect(() => {
    void load().then(setFolder)
  }, [load])

  const change = async (): Promise<void> => {
    const chosen = await choose()
    if (chosen) setFolder(chosen)
  }

  return (
    <>
      <span className="settings-label">
        {label}
        <HelpTip text={hint} />
      </span>
      <div className="settings-folder">
        <span className="settings-path" title={folder ?? undefined}>
          {folder}
        </span>
        <Button size="sm" variant="quiet" aria-label={changeLabel} onClick={() => void change()}>
          {t('settings.changeFolder')}
        </Button>
      </div>
    </>
  )
}

interface Props {
  /** Closes the dialog and opens the mic check. */
  onMicCheck(): void
}

/** App settings: the mic, where songs and exports go, and how Rove looks and reads. */
export function SettingsSection({ onMicCheck }: Props): React.JSX.Element {
  const { theme, setTheme } = useTheme()
  const { textSize, setTextSize } = useTextSize()

  return (
    <div className="settings">
      <span className="settings-label">
        {t('settings.microphone')}
        <HelpTip text={t('settings.microphoneHint')} />
      </span>
      <div>
        <Button size="sm" variant="quiet" onClick={onMicCheck}>
          {t('settings.checkMicrophone')}
        </Button>
      </div>

      <FolderSetting
        label={t('settings.songsFolder')}
        hint={t('settings.songsFolderHint')}
        changeLabel={t('settings.changeSongsFolder')}
        load={window.api.getSongsFolder}
        choose={window.api.chooseSongsFolder}
      />

      <FolderSetting
        label={t('settings.exportsFolder')}
        hint={t('settings.exportsFolderHint')}
        changeLabel={t('settings.changeExportsFolder')}
        load={window.api.getExportsFolder}
        choose={window.api.chooseExportsFolder}
      />

      <span className="settings-label">{t('settings.appearance')}</span>
      <Segmented
        label={t('settings.appearance')}
        options={THEME_OPTIONS}
        value={theme}
        onChange={setTheme}
      />

      <span className="settings-label">{t('settings.textSize')}</span>
      <Segmented
        label={t('settings.textSize')}
        options={TEXT_SIZE_OPTIONS}
        value={textSize}
        onChange={setTextSize}
      />
    </div>
  )
}
