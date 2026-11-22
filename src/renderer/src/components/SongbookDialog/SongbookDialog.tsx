import { useState } from 'react'
import { t } from '@shared/copy'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { cx } from '../ui/cx'
import { SongList } from './SongList'
import { Wishlist } from './Wishlist'
import './SongbookDialog.css'

interface Props {
  /** Folder names already open in tabs, so the Songbook can mark them and block removal. */
  openFolders: string[]
  /** Opens the song in a tab; the dialog closes itself. */
  onOpen(folder: string): void
  /** Starts a new song (opens the New Song dialog). */
  onNew(): void
  /** Makes a real song from a wishlist item. */
  onStart(name: string, artist?: string): void
  onClose(): void
}

type View = 'songs' | 'wishlist'

const VIEWS: View[] = ['songs', 'wishlist']

/** Your songs (folders that exist) and your wishlist (songs to try later). */
export function SongbookDialog({
  openFolders,
  onOpen,
  onNew,
  onStart,
  onClose
}: Props): React.JSX.Element {
  const [view, setView] = useState<View>('songs')
  const [query, setQuery] = useState('')
  return (
    <Dialog
      title={t('songbook.title')}
      closeLabel={t('songbook.close')}
      onClose={onClose}
      className="songbook"
    >
      <div className="songbook-views" role="group" aria-label={t('songbook.viewsLabel')}>
        {VIEWS.map((v) => (
          <button
            key={v}
            type="button"
            className={cx('songbook-view', view === v && 'active')}
            aria-pressed={view === v}
            onClick={() => setView(v)}
          >
            {t(`songbook.views.${v}`)}
          </button>
        ))}
      </div>
      <input
        type="search"
        className="songbook-search"
        aria-label={t('songbook.searchLabel')}
        placeholder={t('songbook.searchPlaceholder')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {/* A steady height, so the dialog doesn't jump around as a search narrows the list. */}
      <div className="songbook-body">
        {view === 'songs' ? (
          <SongList openFolders={openFolders} query={query} onOpen={onOpen} />
        ) : (
          <Wishlist query={query} onStart={onStart} />
        )}
      </div>
      {view === 'songs' && (
        <div className="songbook-footer">
          <Button icon="plus" onClick={onNew}>
            {t('songbook.newSong')}
          </Button>
        </div>
      )}
    </Dialog>
  )
}
