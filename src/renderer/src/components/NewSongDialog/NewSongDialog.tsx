import { useRef, useState } from 'react'
import { SONG_NAME_MAX_LENGTH } from '@shared/constants'
import { t } from '@shared/copy'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import './NewSongDialog.css'

interface Props {
  onCreate(name: string): void
  onClose(): void
}

/** Names a new song before it's made: the folder, the tab and the lyrics search use it. */
export function NewSongDialog({ onCreate, onClose }: Props): React.JSX.Element {
  const [name, setName] = useState('')
  const field = useRef<HTMLInputElement>(null)
  const trimmed = name.trim()
  return (
    <Dialog
      title={t('newSong.title')}
      closeLabel={t('newSong.cancel')}
      onClose={onClose}
      initialFocus={field}
      className="new-song"
    >
      <form
        className="new-song-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (trimmed) onCreate(trimmed)
        }}
      >
        <input
          ref={field}
          type="text"
          aria-label={t('newSong.nameLabel')}
          placeholder={t('newSong.namePlaceholder')}
          value={name}
          maxLength={SONG_NAME_MAX_LENGTH}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="new-song-actions">
          <Button variant="quiet" onClick={onClose}>
            {t('newSong.cancel')}
          </Button>
          <Button type="submit" disabled={!trimmed}>
            {t('newSong.create')}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
