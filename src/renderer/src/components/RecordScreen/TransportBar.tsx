import { t } from '@shared/copy'
import { PERCENT } from '@shared/units'
import { formatClock, formatMillis } from '../../state/ui/format'
import { useShortcuts } from '../../state/commands/shortcuts'
import { gainToSlider, sliderToGain } from '../../audio/mix/mixer'
import { InputMeter } from '../InputMeter'
import { Beat } from '../Beat'
import { IconButton } from '../ui/IconButton'
import { Slider } from '../ui/Slider'
import { cx } from '../ui/cx'

interface Props {
  playing: boolean
  canPlay: boolean
  /** Playing, or paused somewhere past the start. */
  canStop: boolean
  position: number
  source: MediaStreamAudioSourceNode | null
  inputError: string | null
  /** True when the singer has paused listening; the meter sits silent until resumed. */
  micPaused: boolean
  onToggleMicPaused(): void
  /** Linear gain for the master bus (0..1 unity, up to ~2 for a boost). */
  masterVolume: number
  masterMuted: boolean
  onMasterVolume(value: number): void
  onToggleMasterMuted(): void
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
  /** The metronome and the song's tempo, behind one button after the levels. */
  beat?: React.ComponentProps<typeof Beat> | null
}

/** Play/pause and stop, the time, the input level, and the edit tools. */
export function TransportBar(props: Props): React.JSX.Element {
  const shortcuts = useShortcuts()
  const { playing, source, inputError, micPaused, masterVolume, masterMuted } = props
  const masterPercent = Math.round(gainToSlider(masterVolume) * PERCENT)
  const micToggle = (
    <IconButton
      icon={micPaused ? 'vocalsOff' : 'vocals'}
      label={micPaused ? t('transport.resumeListening') : t('transport.pauseListening')}
      aria-pressed={micPaused}
      onClick={props.onToggleMicPaused}
    />
  )
  return (
    <section className="transport">
      <IconButton
        icon={playing ? 'pause' : 'play'}
        iconSize="secondary"
        className="play-button"
        label={playing ? t('transport.pause') : t('transport.play')}
        title={shortcuts.label(playing ? t('transport.pause') : t('transport.play'), 'playPause')}
        disabled={!props.canPlay}
        onClick={props.onTogglePlay}
      />
      <IconButton
        icon="stop"
        iconSize="secondary"
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
      {/* What you hear and what you sing, as a matching pair. */}
      <div className="transport-levels">
        <MasterVolume
          percent={masterPercent}
          muted={masterMuted}
          onChange={(v) => props.onMasterVolume(sliderToGain(v / PERCENT))}
          onReset={() => props.onMasterVolume(1)}
          onToggleMuted={props.onToggleMasterMuted}
        />
        <div className="transport-level" title={inputError ?? undefined}>
          {micToggle}
          {source ? (
            <InputMeter source={source} showLabel={false} hint="off" />
          ) : (
            <div className="meter-track" aria-hidden="true" />
          )}
        </div>
        {props.beat && <Beat {...props.beat} />}
      </div>
      <div className="transport-tools">
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
            icon="chordSheet"
            label={t('chords.label')}
            title={shortcuts.label(
              props.chordsOpen ? t('chords.hide') : t('chords.show'),
              'toggleChords'
            )}
            aria-pressed={props.chordsOpen}
            onClick={props.onToggleChords}
          />
        </div>
      </div>
    </section>
  )
}

interface MasterVolumeProps {
  percent: number
  muted: boolean
  onChange(percent: number): void
  onReset(): void
  onToggleMuted(): void
}

/** Speaker (click to mute) and the same volume slider each track lane uses. */
function MasterVolume({
  percent,
  muted,
  onChange,
  onReset,
  onToggleMuted
}: MasterVolumeProps): React.JSX.Element {
  const title = muted
    ? t('transport.masterVolumeMutedTitle')
    : t('transport.masterVolumeTitle', { percent })
  return (
    <div className={cx('transport-level', muted && 'muted')}>
      <IconButton
        icon={muted ? 'muted' : 'volume'}
        className="level-toggle"
        label={muted ? t('transport.resume') : t('transport.mute')}
        title={title}
        aria-pressed={muted}
        onClick={onToggleMuted}
      />
      <Slider
        tone="muted"
        min={0}
        max={PERCENT}
        value={percent}
        disabled={muted}
        label={t('transport.masterVolume')}
        valueText={t('transport.masterVolumeValue', { percent })}
        title={title}
        onChange={onChange}
        onDoubleClick={onReset}
      />
    </div>
  )
}
