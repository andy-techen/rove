import { useRef, useState } from 'react'
import { SONG_NAME_MAX_LENGTH } from '@shared/constants'
import { t } from '@shared/copy'
import { Tooltip } from '../ui/Tooltip'

interface Props {
  name: string
  disabled: boolean
  onRename(name: string): void
}

/** The active song's name: click to rename, Enter to save, Esc to cancel. */
export function SongName({ name, disabled, onRename }: Props): React.JSX.Element {
  const [draft, setDraft] = useState<string | null>(null)
  // The name's width when editing starts: the field keeps it so the tab doesn't resize.
  const [width, setWidth] = useState(0)
  // Enter saves and the input unmounts, which can also fire blur; only save once.
  const done = useRef(false)

  if (draft === null) {
    return (
      <Tooltip text={t('topBar.rename')}>
        <button
          type="button"
          className="song-name"
          disabled={disabled}
          onClick={(e) => {
            done.current = false
            setWidth(e.currentTarget.offsetWidth)
            setDraft(name)
          }}
        >
          {name}
        </button>
      </Tooltip>
    )
  }

  const commit = (): void => {
    if (done.current) return
    done.current = true
    setDraft(null)
    if (draft.trim()) onRename(draft)
  }

  return (
    <input
      className="song-name-input"
      style={{ '--song-name-width': `${width}px` } as React.CSSProperties}
      aria-label={t('topBar.songName')}
      value={draft}
      maxLength={SONG_NAME_MAX_LENGTH}
      autoFocus
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit()
        if (e.key === 'Escape') {
          done.current = true
          setDraft(null)
        }
      }}
    />
  )
}
