import { useEffect, useState } from 'react'
import { t } from '@shared/copy'
import type { SongbookEntry } from '@shared/songs/project'
import { useShortcuts } from '../../state/commands/shortcuts'
import { relativeTime } from '../../state/ui/format'
import { useFullScreen } from '../../state/ui/useFullScreen'
import { Button } from '../ui/Button'
import { Logo } from '../ui/Logo'
import { Tooltip } from '../ui/Tooltip'
import { RECENT_SONGS } from '@shared/constants'
import './Welcome.css'

interface Props {
  onNew(): void
  onOpen(): void
  /** Asks for a .rove project file and opens it. */
  onImport(): void
  onSongbook(): void
  /** Opens a recent song by its folder name under the songs folder. */
  onOpenSong(folder: string): void
}

/** With no song open: start one, open one, or pick up a recent one. */
export function Welcome({
  onNew,
  onOpen,
  onImport,
  onSongbook,
  onOpenSong
}: Props): React.JSX.Element {
  const shortcuts = useShortcuts()
  const [recent, setRecent] = useState<SongbookEntry[]>([])
  // On macOS the window has no title bar of its own here; the top strip drags it.
  const isMac = window.api.platform === 'darwin'
  const fullScreen = useFullScreen()

  useEffect(() => {
    let cancelled = false
    // The buttons still work without the list, so a failed read just shows none.
    window.api.listSongs().then(
      (songs) => !cancelled && setRecent(songs.slice(0, RECENT_SONGS)),
      () => {}
    )
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="welcome">
      {isMac && !fullScreen && <div className="welcome-drag" />}
      <main className="welcome-body">
        <header>
          <h1 className="welcome-logo">
            <Logo size="lg" />
          </h1>
          <p className="muted">{t('welcome.title')}</p>
        </header>
        <div className="row welcome-actions">
          <Tooltip text={shortcuts.label(t('welcome.newSong'), 'newSong')}>
            <Button icon="plus" onClick={onNew}>
              {t('welcome.newSong')}
            </Button>
          </Tooltip>
          <Tooltip text={shortcuts.label(t('welcome.openTitle'), 'open')}>
            <Button variant="secondary" icon="folder" onClick={onOpen}>
              {t('welcome.open')}
            </Button>
          </Tooltip>
          <Tooltip text={t('welcome.importTitle')}>
            <Button variant="secondary" icon="import" onClick={onImport}>
              {t('welcome.import')}
            </Button>
          </Tooltip>
          <Tooltip text={shortcuts.label(t('welcome.songbook'), 'songbook')}>
            <Button variant="secondary" icon="songbook" onClick={onSongbook}>
              {t('welcome.songbook')}
            </Button>
          </Tooltip>
        </div>
        {recent.length > 0 && (
          <section className="welcome-recent">
            {/* No visible heading: under the question, the list explains itself. */}
            <ul aria-label={t('welcome.recent')}>
              {recent.map((song) => (
                <li key={song.folder}>
                  <button
                    type="button"
                    className="welcome-song"
                    aria-label={t('welcome.openSong', { name: song.name })}
                    onClick={() => onOpenSong(song.folder)}
                  >
                    <span className="welcome-song-title">
                      <span className="welcome-song-name">{song.name}</span>
                      {song.artist && <span className="welcome-song-artist">{song.artist}</span>}
                    </span>
                    <span className="welcome-song-when">{relativeTime(song.modifiedAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  )
}
