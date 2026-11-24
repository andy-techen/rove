import { useState } from 'react'
import { t } from '@shared/copy'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { SearchField } from '../ui/SearchField'
import { cx } from '../ui/cx'
import { NewSongDialog } from '../NewSongDialog'
import { Explore } from './Explore'
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
  /** Makes a real song from a wishlist item, keeping its artist and note. */
  onStart(name: string, artist?: string, note?: string): void
  onClose(): void
}

type View = 'songs' | 'wishlist' | 'explore'

const VIEWS: View[] = ['songs', 'wishlist', 'explore']

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
  const [addingWish, setAddingWish] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  // Bumped after an add so the wishlist reloads with the new item.
  const [wishlistVersion, setWishlistVersion] = useState(0)

  const addWish = async (name: string, artist?: string, note?: string): Promise<void> => {
    setAddingWish(false)
    try {
      await window.api.addToWishlist(name, artist, note)
      setAddError(null)
      setWishlistVersion((v) => v + 1)
    } catch {
      setAddError(t('songbook.wishlistError'))
    }
  }
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
      {/* One height for every tab, so switching tabs doesn't resize the dialog. */}
      <div className="songbook-panel">
        {view !== 'explore' && (
          <SearchField
            className="songbook-search"
            label={t('songbook.searchLabel')}
            placeholder={t('songbook.searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        )}
        <div className={cx('songbook-body', view === 'explore' && 'songbook-body-explore')}>
          {view === 'songs' && <SongList openFolders={openFolders} query={query} onOpen={onOpen} />}
          {view === 'explore' && <Explore />}
          {view === 'wishlist' && (
            <Wishlist key={wishlistVersion} query={query} onStart={onStart} />
          )}
        </div>
        {view === 'songs' && (
          <div className="songbook-footer">
            <Button icon="plus" onClick={onNew}>
              {t('songbook.newSong')}
            </Button>
          </div>
        )}
        {view === 'wishlist' && (
          <div className="songbook-footer">
            {addError && <p className="songbook-note songbook-error">{addError}</p>}
            <Button icon="plus" onClick={() => setAddingWish(true)}>
              {t('songbook.addToWishlistButton')}
            </Button>
          </div>
        )}
      </div>
      {addingWish && (
        <NewSongDialog
          title={t('songbook.addToWishlistButton')}
          submitLabel={t('songbook.addToWishlist')}
          onCreate={(name, artist, note) => void addWish(name, artist, note)}
          onClose={() => setAddingWish(false)}
        />
      )}
    </Dialog>
  )
}
