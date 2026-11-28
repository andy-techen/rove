import { useEffect, useState } from 'react'
import { t } from '@shared/copy'
import type { SongbookEntry } from '@shared/songs/project'
import { NewSongDialog } from '../NewSongDialog'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { IconButton } from '../ui/IconButton'
import { relativeTime } from '../../state/ui/format'
import { matchesSearch } from './search'

interface Props {
  /** Folder names already open in tabs: marked, and they can't be removed. */
  openFolders: string[]
  /** What's typed in the Songbook's search box. */
  query: string
  onOpen(folder: string): void
}

type State = { kind: 'loading' } | { kind: 'ready'; songs: SongbookEntry[] } | { kind: 'error' }

/** Songs that exist in the songs folder, newest first. */
export function SongList({ openFolders, query, onOpen }: Props): React.JSX.Element {
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [removing, setRemoving] = useState<SongbookEntry | null>(null)
  const [editing, setEditing] = useState<SongbookEntry | null>(null)
  const [rowError, setRowError] = useState<string | null>(null)
  const open = new Set(openFolders)

  useEffect(() => {
    let cancelled = false
    window.api.listSongs().then(
      (songs) => !cancelled && setState({ kind: 'ready', songs }),
      () => !cancelled && setState({ kind: 'error' })
    )
    return () => {
      cancelled = true
    }
  }, [])

  const remove = async (folder: string): Promise<void> => {
    setRemoving(null)
    try {
      await window.api.removeSongbookSong(folder)
      setState((prev) =>
        prev.kind === 'ready'
          ? { kind: 'ready', songs: prev.songs.filter((s) => s.folder !== folder) }
          : prev
      )
      setRowError(null)
    } catch {
      setRowError(t('songbook.removeFailed'))
    }
  }

  const edit = async (
    folder: string,
    name: string,
    artist?: string,
    note?: string
  ): Promise<void> => {
    setEditing(null)
    try {
      const updated = await window.api.updateSongbookSong(folder, name, artist, note)
      setState((prev) =>
        prev.kind === 'ready'
          ? { kind: 'ready', songs: prev.songs.map((s) => (s.folder === folder ? updated : s)) }
          : prev
      )
      setRowError(null)
    } catch {
      setRowError(t('songbook.editFailed'))
    }
  }

  if (state.kind === 'loading') return <p className="songbook-note">{t('songbook.loading')}</p>
  if (state.kind === 'error') {
    return <p className="songbook-note songbook-error">{t('songbook.error')}</p>
  }
  if (state.songs.length === 0) return <p className="songbook-note">{t('songbook.empty')}</p>

  const shown = state.songs.filter((song) => matchesSearch(song, query))
  if (shown.length === 0) return <p className="songbook-note">{t('songbook.noMatches')}</p>

  return (
    <>
      <ul className="songbook-list">
        {shown.map((song) => {
          const alreadyOpen = open.has(song.folder)
          return (
            <li key={song.folder} className="songbook-item">
              <button
                type="button"
                className="songbook-open"
                aria-label={
                  alreadyOpen
                    ? t('songbook.itemOpen', { name: song.name })
                    : t('songbook.item', { name: song.name })
                }
                onClick={() => onOpen(song.folder)}
              >
                <span className="songbook-title">
                  <span className="songbook-name">{song.name}</span>
                  {song.artist && <span className="songbook-artist">{song.artist}</span>}
                  {song.note && <span className="songbook-note-text">{song.note}</span>}
                </span>
                <span className="songbook-when">
                  {alreadyOpen ? t('songbook.alreadyOpen') : relativeTime(song.modifiedAt)}
                </span>
              </button>
              <IconButton
                icon="edit"
                iconSize="secondary"
                label={t('songbook.editLabel', { name: song.name })}
                title={alreadyOpen ? t('songbook.cantEditOpen') : undefined}
                disabled={alreadyOpen}
                onClick={() => setEditing(song)}
              />
              <IconButton
                icon="delete"
                iconSize="secondary"
                label={t('songbook.removeLabel', { name: song.name })}
                title={alreadyOpen ? t('songbook.cantRemoveOpen') : undefined}
                disabled={alreadyOpen}
                onClick={() => setRemoving(song)}
              />
            </li>
          )
        })}
      </ul>
      {rowError && <p className="songbook-note songbook-error">{rowError}</p>}
      {editing && (
        <NewSongDialog
          editing={editing}
          onCreate={(name, artist, note) => void edit(editing.folder, name, artist, note)}
          onClose={() => setEditing(null)}
        />
      )}
      {removing && (
        // Removing a song takes its recordings with it, so say so plainly first.
        <ConfirmDialog
          title={t('songbook.removeTitle', { name: removing.name })}
          message={t('songbook.removeWarning')}
          confirmLabel={t('songbook.remove')}
          danger
          sizeKey="removeSong"
          onConfirm={() => void remove(removing.folder)}
          onCancel={() => setRemoving(null)}
        />
      )}
    </>
  )
}
