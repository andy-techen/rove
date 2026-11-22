import { t } from '@shared/copy'
import { formatClock, formatMillis } from '../../state/song/project'
import { useShortcuts } from '../../state/commands/shortcuts'
import { InputMeter } from '../InputMeter'
import { IconButton } from '../ui/IconButton'

interface Props {
  playing: boolean
  canPlay: boolean
  /** Playing, or paused somewhere past the start. */
  canStop: boolean
  position: number
  source: MediaStreamAudioSourceNode | null
  inputError: string | null
  canUndo: boolean
  canRedo: boolean
  canSplit: boolean
  canDelete: boolean
  onTogglePlay(): void
  onStop(): void
  onUndo(): void
  onRedo(): void
  onSplit(): void
  onDelete(): void
  lyricsOpen: boolean
  onToggleLyrics(): void
  chordsOpen: boolean
  onToggleChords(): void
}

const PLAY_ICON_SIZE = 14

/** Play/pause and stop, the time, the input level, and the edit tools. */
export function TransportBar(props: Props): React.JSX.Element {
  const shortcuts = useShortcuts()
  const { playing, source, inputError } = props
  return (
    <section className="transport">
      <IconButton
        icon={playing ? 'pause' : 'play'}
        iconSize={PLAY_ICON_SIZE}
        className="play-button"
        label={playing ? t('transport.pause') : t('transport.play')}
        title={shortcuts.label(playing ? t('transport.pause') : t('transport.play'), 'playPause')}
        disabled={!props.canPlay}
        onClick={props.onTogglePlay}
      />
      <IconButton
        icon="stop"
        iconSize={PLAY_ICON_SIZE}
        className="stop-button"
        label={t('transport.stopPlayback')}
        title={shortcuts.label(t('transport.stopPlaybackTitle'), 'stopPlayback')}
        disabled={!props.canStop}
        onClick={props.onStop}
      />
      <span className="timer">
        {formatClock(props.position)}
        <span className="timer-ms">{formatMillis(props.position)}</span>
      </span>
      <div className="transport-meter">
        {source && <InputMeter source={source} showLabel={false} hint="warnings" />}
        {inputError && <p className="error">{inputError}</p>}
      </div>
      <div className="edit-tools" role="toolbar" aria-label={t('transport.editToolbar')}>
        <IconButton
          icon="undo"
          label={t('transport.undo')}
          title={shortcuts.label(t('transport.undo'), 'undo')}
          disabled={!props.canUndo}
          onClick={props.onUndo}
        />
        <IconButton
          icon="redo"
          label={t('transport.redo')}
          title={shortcuts.label(t('transport.redo'), 'redo')}
          disabled={!props.canRedo}
          onClick={props.onRedo}
        />
        <IconButton
          icon="split"
          label={t('transport.split')}
          title={shortcuts.label(t('transport.split'), 'split')}
          disabled={!props.canSplit}
          onClick={props.onSplit}
        />
        <IconButton
          icon="delete"
          label={t('transport.delete')}
          title={shortcuts.label(t('transport.delete'), 'deleteClip')}
          disabled={!props.canDelete}
          onClick={props.onDelete}
        />
      </div>
      {/* The side panels, set apart from the edit tools. */}
      <div className="panel-toggles" role="toolbar" aria-label={t('transport.panelsToolbar')}>
        <IconButton
          icon="lyrics"
          label={t('lyrics.label')}
          title={shortcuts.label(
            props.lyricsOpen ? t('lyrics.hide') : t('lyrics.show'),
            'toggleLyrics'
          )}
          aria-pressed={props.lyricsOpen}
          onClick={props.onToggleLyrics}
        />
        <IconButton
          icon="chords"
          label={t('chords.label')}
          title={shortcuts.label(
            props.chordsOpen ? t('chords.hide') : t('chords.show'),
            'toggleChords'
          )}
          aria-pressed={props.chordsOpen}
          onClick={props.onToggleChords}
        />
      </div>
    </section>
  )
}
