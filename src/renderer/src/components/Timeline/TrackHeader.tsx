import { DragEvent } from 'react'
import { t } from '@shared/copy'
import { TRACK_NAME_MAX_LENGTH, TrackRole } from '../../state/song/project'
import { SelectMode, selectMode } from '../../state/editing/trackSelection'
import { cx } from '../ui/cx'
import { IconButton } from '../ui/IconButton'
import { NameField } from '../ui/NameField'
import { Tooltip } from '../ui/Tooltip'

interface Props {
  name: string
  detail: string
  role: TrackRole
  recording: boolean
  /** Some other track is recording, or recording isn't possible right now. */
  recordDisabled: boolean
  selected: boolean
  /** Recording, or the song is busy: tracks stay put. */
  onSelect(mode: SelectMode): void
  onContextMenu(): void
  onRecord(): void
  onStop(): void
  /** Whether the track can be dragged to a new place right now. */
  draggable: boolean
  onDragStart(e: DragEvent<HTMLDivElement>): void
  onDragEnd(): void
  /** The name is being edited in place. */
  renaming: boolean
  onStartRename(): void
  onRename(name: string): void
  onRenameDone(): void
}

const RECORD_ICON_SIZE = 12

/**
 * Left side of a lane: the track's name (click to select, double-click to rename, drag to
 * move) and its record button.
 */
export function TrackHeader({
  name,
  detail,
  role,
  recording,
  recordDisabled,
  selected,
  onSelect,
  onContextMenu,
  onRecord,
  onStop,
  draggable,
  onDragStart,
  onDragEnd,
  renaming,
  onStartRename,
  onRename,
  onRenameDone
}: Props): React.JSX.Element {
  return (
    <div
      className={cx('lane-header', 'track-header', selected && 'track-selected')}
      draggable={draggable && !renaming}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onContextMenu={(e) => {
        e.preventDefault()
        onContextMenu()
      }}
    >
      {renaming ? (
        <NameField
          className="lane-name-input"
          label={t('track.nameLabel')}
          initial={name}
          maxLength={TRACK_NAME_MAX_LENGTH}
          onSave={onRename}
          onDone={onRenameDone}
        />
      ) : (
        <Tooltip
          text={
            role === 'vocal'
              ? t('track.selectVocal', { name })
              : t('track.selectBacking', { name, detail })
          }
        >
          <button
            type="button"
            className="lane-title"
            onClick={(e) => onSelect(selectMode(e))}
            onDoubleClick={onStartRename}
            aria-pressed={selected}
          >
            <span className="lane-name">{name}</span>
            <span className="lane-detail">{detail}</span>
          </button>
        </Tooltip>
      )}
      {recording ? (
        <IconButton
          icon="stop"
          iconSize={RECORD_ICON_SIZE}
          className="track-record recording"
          label={t('track.stop', { name })}
          title={t('track.stopTitle')}
          onClick={onStop}
        />
      ) : (
        <IconButton
          icon="record"
          iconSize={RECORD_ICON_SIZE}
          className="track-record"
          label={t('track.record', { name })}
          disabled={recordDisabled}
          onClick={onRecord}
        />
      )}
    </div>
  )
}
