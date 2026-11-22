import { useState } from 'react'
import { SONG_NAME_MAX_LENGTH } from '@shared/constants'
import { t } from '@shared/copy'
import { NameField } from '../ui/NameField'
import { Tooltip } from '../ui/Tooltip'

interface Props {
  name: string
  disabled: boolean
  onRename(name: string): void
}

/** The active song's name: click to rename, Enter to save, Esc to cancel. */
export function SongName({ name, disabled, onRename }: Props): React.JSX.Element {
  // The name's width when editing starts, or null when not editing: the field keeps the
  // width so the tab doesn't resize.
  const [width, setWidth] = useState<number | null>(null)

  if (width === null) {
    return (
      <Tooltip text={t('topBar.rename')}>
        <button
          type="button"
          className="song-name"
          disabled={disabled}
          onClick={(e) => setWidth(e.currentTarget.offsetWidth)}
        >
          {name}
        </button>
      </Tooltip>
    )
  }

  return (
    <NameField
      className="song-name-input"
      style={{ '--song-name-width': `${width}px` } as React.CSSProperties}
      label={t('topBar.songName')}
      initial={name}
      maxLength={SONG_NAME_MAX_LENGTH}
      onSave={onRename}
      onDone={() => setWidth(null)}
    />
  )
}
