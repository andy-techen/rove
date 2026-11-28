import { useEffect, useState } from 'react'
import { t } from '@shared/copy'
import type { WishlistItem } from '@shared/preferences/wishlist'
import { NewSongDialog } from '../NewSongDialog'
import { IconButton } from '../ui/IconButton'
import { matchesSearch } from './search'

interface Props {
  /** What's typed in the Songbook's search box. */
  query: string
  /** Turns a wishlist item into a real song; the item has already left the list. */
  onStart(name: string, artist?: string, note?: string): void
}

/** Songs to try later: just a name and maybe a artist, no folder until started. */
export function Wishlist({ query, onStart }: Props): React.JSX.Element {
  const [items, setItems] = useState<WishlistItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<WishlistItem | null>(null)

  useEffect(() => {
    let cancelled = false
    window.api.listWishlist().then(
      (list) => !cancelled && setItems(list),
      () => !cancelled && setError(t('songbook.wishlistError'))
    )
    return () => {
      cancelled = true
    }
  }, [])

  const update = async (change: Promise<WishlistItem[]>): Promise<boolean> => {
    try {
      setItems(await change)
      setError(null)
      return true
    } catch {
      setError(t('songbook.wishlistError'))
      return false
    }
  }

  const shown = items?.filter((item) => matchesSearch(item, query)) ?? null

  return (
    <>
      {items && items.length === 0 && (
        <p className="songbook-note">{t('songbook.wishlistEmpty')}</p>
      )}
      {items && items.length > 0 && shown?.length === 0 && (
        <p className="songbook-note">{t('songbook.noMatches')}</p>
      )}
      {shown && shown.length > 0 && (
        <ul className="songbook-list">
          {shown.map((item) => (
            <li key={item.id} className="songbook-item wishlist-item">
              <span className="songbook-title">
                <span className="songbook-name">{item.name}</span>
                {item.artist && <span className="songbook-artist">{item.artist}</span>}
                {item.note && <span className="songbook-note-text">{item.note}</span>}
              </span>
              <IconButton
                icon="edit"
                iconSize="secondary"
                label={t('songbook.editLabel', { name: item.name })}
                onClick={() => setEditing(item)}
              />
              <IconButton
                icon="mic"
                iconSize="secondary"
                label={t('songbook.startLabel', { name: item.name })}
                onClick={async () => {
                  if (await update(window.api.removeFromWishlist(item.id))) {
                    onStart(item.name, item.artist, item.note)
                  }
                }}
              />
              <IconButton
                icon="delete"
                iconSize="secondary"
                label={t('songbook.removeLabel', { name: item.name })}
                onClick={() => void update(window.api.removeFromWishlist(item.id))}
              />
            </li>
          ))}
        </ul>
      )}
      {error && <p className="songbook-note songbook-error">{error}</p>}
      {editing && (
        <NewSongDialog
          editing={editing}
          onCreate={(name, artist, note) => {
            setEditing(null)
            void update(window.api.updateWishlistItem(editing.id, name, artist, note))
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}
