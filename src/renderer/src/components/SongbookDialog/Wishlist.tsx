import { useEffect, useRef, useState } from 'react'
import { SONG_NAME_MAX_LENGTH } from '@shared/constants'
import { t } from '@shared/copy'
import type { WishlistItem } from '@shared/wishlist'
import { Button } from '../ui/Button'
import { IconButton } from '../ui/IconButton'
import { matchesSearch } from './search'

interface Props {
  /** What's typed in the Songbook's search box. */
  query: string
  /** Turns a wishlist item into a real song; the item has already left the list. */
  onStart(name: string, artist?: string): void
}

const REMOVE_ICON_SIZE = 16

/** Songs to try later: just a name and maybe a artist, no folder until started. */
export function Wishlist({ query, onStart }: Props): React.JSX.Element {
  const [items, setItems] = useState<WishlistItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [artist, setArtist] = useState('')
  const nameField = useRef<HTMLInputElement>(null)

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

  const trimmedName = name.trim()
  const shown = items?.filter((item) => matchesSearch(item, query)) ?? null

  return (
    <>
      <form
        className="wishlist-add"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!trimmedName) return
          if (await update(window.api.addToWishlist(trimmedName, artist.trim() || undefined))) {
            setName('')
            setArtist('')
            nameField.current?.focus()
          }
        }}
      >
        <input
          ref={nameField}
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
        <Button type="submit" icon="plus" disabled={!trimmedName}>
          {t('songbook.addToWishlist')}
        </Button>
      </form>
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
              </span>
              <Button
                size="sm"
                variant="quiet"
                aria-label={t('songbook.startLabel', { name: item.name })}
                onClick={async () => {
                  if (await update(window.api.removeFromWishlist(item.id))) {
                    onStart(item.name, item.artist)
                  }
                }}
              >
                {t('songbook.start')}
              </Button>
              <IconButton
                icon="delete"
                iconSize={REMOVE_ICON_SIZE}
                label={t('songbook.removeLabel', { name: item.name })}
                onClick={() => void update(window.api.removeFromWishlist(item.id))}
              />
            </li>
          ))}
        </ul>
      )}
      {error && <p className="songbook-note songbook-error">{error}</p>}
    </>
  )
}
