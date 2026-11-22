import { useRef, useState } from 'react'
import { SONG_NAME_MAX_LENGTH } from '@shared/constants'
import { t } from '@shared/copy'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import './NewSongDialog.css'

interface Props {
  onCreate(name: string, artist?: string): void
  onClose(): void
  /** A song's current details, to change them rather than start a new song. */
  editing?: { name: string; artist?: string }
}

/**
 * Names a song: a new one before it's made (the folder, the tab and the lyrics search
 * use the name), or an existing one from the Songbook.
 */
export function NewSongDialog({ onCreate, onClose, editing }: Props): React.JSX.Element {
  const [name, setName] = useState(editing?.name ?? '')
  const [artist, setArtist] = useState(editing?.artist ?? '')
  const field = useRef<HTMLInputElement>(null)
  const trimmedName = name.trim()
  const trimmedArtist = artist.trim()
  return (
    <Dialog
      title={editing ? t('newSong.editTitle') : t('newSong.title')}
      closeLabel={t('newSong.cancel')}
      onClose={onClose}
      initialFocus={field}
      className="new-song"
    >
      <form
        className="new-song-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (trimmedName) onCreate(trimmedName, trimmedArtist || undefined)
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
        <input
          type="text"
          aria-label={t('newSong.artistLabel')}
          placeholder={t('newSong.artistPlaceholder')}
          value={artist}
          maxLength={SONG_NAME_MAX_LENGTH}
          onChange={(e) => setArtist(e.target.value)}
        />
        <div className="new-song-actions">
          <Button variant="quiet" onClick={onClose}>
            {t('newSong.cancel')}
          </Button>
          <Button type="submit" disabled={!trimmedName}>
            {editing ? t('newSong.save') : t('newSong.create')}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
