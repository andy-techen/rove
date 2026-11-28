import { CSSProperties, MouseEvent, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { t } from '@shared/copy'
import {
  BEAT_NAME_MAX_LENGTH,
  BEAT_PARTS,
  BeatPart,
  PadHit,
  BarBeat,
  BeatChart,
  BeatsPerBar,
  MyBeat,
  PadDrum,
  mineOf,
  nextBeatNumber
} from '../../state/song/project'
import { ChartPlace } from '../../state/chords/chart'
import { repeatLine } from '../../state/chords/chartBars'
import { SNAP_BEATS, beatName, hitsFrom } from '../../state/chords/beats'
import { useBeatRecorder } from '../../state/chords/useBeatRecorder'
import { Button } from '../ui/Button'
import { HelpTip } from '../ui/HelpTip'
import { IconButton } from '../ui/IconButton'
import { NameField } from '../ui/NameField'
import { raised } from '../ui/Raised'
import { SearchField } from '../ui/SearchField'
import { Tooltip } from '../ui/Tooltip'
import { cx } from '../ui/cx'
import { BarTools } from './BarTools'
import { BeatPad } from './BeatPad'
import { usePadKeys } from './padKeys'
import { useBarGrid } from './useBarGrid'
import { Switch } from '../ui/Switch'

interface Props {
  beats: BeatChart
  /** Beats in a bar, from the song's tempo: a line holds as many bars. */
  beatsPerBar: BeatsPerBar
  /** How long a beat lasts as it plays, at the song's tempo and Speed. */
  secPerBeat: number
  /** The bar under the playhead, or -1. */
  playingBar: number
  locked: boolean
  onParts(parts: BarBeat[]): void
  /** A beat of your own made or changed; `parts` comes too when bars start playing it. */
  onMyBeat(beat: MyBeat, parts?: BarBeat[]): void
  /** Lets the singer hear a drum as it's placed on the pad. */
  onPreviewDrum(drum: PadDrum): void
  /** Takes a beat of your own away. */
  onDeleteBeat(n: number): void
  /** Plays one bar of `part` to hear it, calling `onEnded` after; null stops it. */
  onHear(part: BarBeat | null, onEnded?: () => void): void
  /** Takes the picked bars out, as Delete does on the timeline. */
  onRemove(): void
  /** The bars being set; a bar clicked on the timeline moves it. */
  place: ChartPlace
  onPlace(place: ChartPlace): void
}

const MS_PER_SEC = 1000

/** Setting an instrumental's drums: how busy each bar is, within the song's groove. */
export function BeatsEditor({
  beats,
  beatsPerBar,
  secPerBeat,
  playingBar,
  locked,
  onParts,
  onMyBeat,
  onPreviewDrum,
  onHear,
  onDeleteBeat,
  onRemove,
  place,
  onPlace
}: Props): React.JSX.Element {
  const { parts } = beats
  const barsPerLine = beatsPerBar
  const { selected, first, last, lineIsFull, select, barRef, onGridKey, pickNewBar } = useBarGrid({
    count: parts.length,
    barsPerLine,
    place,
    onPlace,
    locked,
    onRemove
  })

  const withPicked = (part: BarBeat): BarBeat[] =>
    parts.map((p, i) => (i >= first && i <= last ? part : p))

  // The pad shows in the picker; expanded, it has the panel to itself.
  const [expanded, setExpanded] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const newBeat = (): void => {
    const beat = { n: nextBeatNumber(beats), hits: hitsFrom(beats, beatsPerBar, parts[first]) }
    onMyBeat(beat, withPicked(mineOf(beat)))
  }

  // A click on a part leaves focus in the bars, so the arrow keys still move along them.
  const keepFocus = (e: MouseEvent): void => e.preventDefault()

  const barsText =
    last > first
      ? t('chords.barRange', { from: first + 1, to: last + 1 })
      : t('chords.barNumber', { n: selected + 1 })
  const picked = parts.slice(first, last + 1)
  const isPicked = (part: BarBeat): boolean => picked.every((p) => p === part)
  // The beat of your own every picked bar plays, open on the pad.
  const editing = beats.mine?.find((b) => isPicked(mineOf(b)))
  // A built-in part every picked bar plays shows on the pad too, to see how it's made.
  // It's only to look at: New beat makes a copy to change.
  const builtIn =
    !editing && BEAT_PARTS.includes(picked[0] as BeatPart) && isPicked(picked[0])
      ? (picked[0] as BeatPart)
      : null
  const shown: MyBeat | undefined =
    editing ??
    (builtIn
      ? { n: nextBeatNumber(beats), hits: hitsFrom(beats, beatsPerBar, builtIn) }
      : undefined)
  const changeHits = (hits: PadHit[]): void => {
    if (editing) onMyBeat({ ...editing, hits })
  }

  // Your beats sit on one line, newest first. When there are more than fit, the search
  // icon opens them all, with a field to find one by name.
  const [findMine, setFindMine] = useState('')
  const [searching, setSearching] = useState(false)
  const stopSearching = (): void => {
    setSearching(false)
    setFindMine('')
  }
  const mineRow = useRef<HTMLDivElement>(null)
  const [mineOverflow, setMineOverflow] = useState(false)
  // One chip's height: the line shows that much, so a chip is shown whole or not at all.
  const [chipHeight, setChipHeight] = useState(0)
  useLayoutEffect(() => {
    const row = mineRow.current
    if (!row) return
    const measure = (): void => {
      setChipHeight(row.querySelector<HTMLElement>('.picker-chord')?.offsetHeight ?? 0)
      setMineOverflow(row.scrollHeight > row.clientHeight + 1)
    }
    measure()
    const watch = new ResizeObserver(measure)
    watch.observe(row)
    return () => watch.disconnect()
  }, [beats.mine?.length, searching])
  const find = findMine.trim().toLowerCase()
  const mineShown = [...(beats.mine ?? [])]
    .reverse()
    .filter((b) => !searching || beatName(beats, mineOf(b)).toLowerCase().includes(find))

  // Taps snap to sixteenths unless the singer wants them as played.
  const [snap, setSnap] = useState(true)
  const recorder = useBeatRecorder({
    beat: shown,
    beatsPerBar,
    secPerBeat,
    snap,
    onHits: changeHits,
    onPreview: onPreviewDrum
  })
  usePadKeys(!!editing && !locked, {
    drum: recorder.tap,
    record: recorder.toggle,
    hear: () => hear()
  })

  // Hearing plays one bar of the first picked bar's beat, once.
  const [hearing, setHearing] = useState(false)
  const hear = (): void => {
    if (hearing) {
      onHear(null)
      setHearing(false)
      return
    }
    setHearing(true)
    onHear(picked[0], () => setHearing(false))
  }

  // The sixteenth being heard, lit on the pad, while the beat plays or records.
  const [heardColumn, setColumn] = useState<number | null>(null)
  const recording = recorder.state !== 'off'
  const column = hearing || recording ? heardColumn : null
  useEffect(() => {
    if (!hearing && !recording) return
    // Playing once starts as the button is pressed; the loop knows its own place.
    const from = performance.now()
    let frame = 0
    const follow = (): void => {
      const at = recording
        ? recorder.position()
        : (performance.now() - from) / MS_PER_SEC / secPerBeat
      const now = at === null || at < 0 || at >= beatsPerBar ? null : Math.floor(at / SNAP_BEATS)
      // Only a new column re-renders, not every frame.
      setColumn((was) => (was === now ? was : now))
      frame = requestAnimationFrame(follow)
    }
    frame = requestAnimationFrame(follow)
    return () => cancelAnimationFrame(frame)
    // `recorder.position` reads the live loop; it needn't restart this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hearing, recording, secPerBeat, beatsPerBar])
  // Leaving the panel stops it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => onHear(null), [])
  const hearButton = (
    <IconButton
      icon={hearing ? 'stop' : 'play'}
      label={hearing ? t('beats.stopHearing') : t('beats.hear')}
      aria-pressed={hearing}
      className={hearing ? 'beats-hearing' : undefined}
      onClick={hear}
    />
  )

  const nameField = (beat: MyBeat): React.JSX.Element => (
    <NameField
      key={`rename-${beat.n}`}
      className="beats-name-input"
      label={t('beats.nameLabel')}
      initial={beatName(beats, mineOf(beat))}
      maxLength={BEAT_NAME_MAX_LENGTH}
      onSave={(name) => onMyBeat({ ...beat, name: name.trim() })}
      onDone={() => setRenaming(false)}
    />
  )
  const help = editing ? (
    <HelpTip lines={[t('beats.padHelp.record'), t('beats.padHelp.edit')]} />
  ) : (
    <HelpTip text={t('beats.partsHelp')} />
  )
  const recordButton = (
    <span className="beats-record">
      {recorder.state === 'counting' && (
        <span className="beats-record-status" role="status">
          {t('beats.counting')}
        </span>
      )}
      <IconButton
        icon={recorder.state === 'off' ? 'recordRing' : 'stop'}
        className="beats-record-button"
        label={recorder.state === 'off' ? t('beats.record') : t('beats.stopRecording')}
        aria-pressed={recorder.state !== 'off'}
        disabled={locked}
        onClick={recorder.toggle}
      />
    </span>
  )

  // Snap is a setting, so it stands apart; then play and record, and the pad's size. The
  // same in the picker and on the big pad. Help sits with the title, not among buttons.
  const tools = (large: boolean): React.JSX.Element => (
    <span className="beats-pad-tools">
      {editing && (
        <>
          <Switch label={t('beats.snap')} checked={snap} onChange={setSnap} />
          <span className="chart-tools-divider" aria-hidden="true" />
        </>
      )}
      {hearButton}
      {editing && recordButton}
      {editing && (
        <IconButton
          icon="reset"
          label={t('beats.clear')}
          disabled={locked || editing.hits.length === 0}
          onClick={() => changeHits([])}
        />
      )}
      {shown && (
        <IconButton
          icon={large ? 'collapse' : 'expand'}
          label={large ? t('beats.collapse') : t('beats.expand')}
          onClick={() => setExpanded(!large)}
        />
      )}
    </span>
  )

  const pad = (large: boolean): React.JSX.Element | null =>
    shown ? (
      <BeatPad
        beat={shown}
        beatsPerBar={beatsPerBar}
        // A built-in part is shown, not changed.
        locked={locked || !editing}
        large={large}
        snap={snap}
        onHits={changeHits}
        playingColumn={column}
        onPreview={onPreviewDrum}
      />
    ) : null

  const chip = (part: BarBeat): React.JSX.Element => {
    // A beat of your own renames in place, by double-clicking its name.
    if (renaming && editing && part === mineOf(editing)) return nameField(editing)
    const mine = part.startsWith('mine-')
    const button = (
      <button
        key={part}
        type="button"
        className={cx('picker-chord', isPicked(part) && 'picker-chord-on')}
        aria-pressed={isPicked(part)}
        disabled={locked}
        onMouseDown={keepFocus}
        onClick={() => onParts(withPicked(part))}
        onDoubleClick={() => mine && !locked && setRenaming(true)}
      >
        {beatName(beats, part)}
      </button>
    )
    return mine ? (
      <Tooltip key={part} text={t('beats.renameHint')}>
        {button}
      </Tooltip>
    ) : (
      button
    )
  }

  if (expanded && shown) {
    return (
      <section className="beats-pad-full" aria-label={t('beats.pad')}>
        <div className="picker-head">
          <span className="beats-pad-name">
            {renaming && editing ? (
              nameField(editing)
            ) : (
              <>
                <span
                  className="picker-bar"
                  onDoubleClick={() => editing && !locked && setRenaming(true)}
                >
                  {beatName(beats, editing ? mineOf(editing) : picked[0])}
                </span>
                {help}
              </>
            )}
          </span>
          {tools(true)}
        </div>
        {pad(true)}
      </section>
    )
  }

  return (
    <div className="chart-editor beats-editor">
      <div className="chart-sheet">
        {/* Tools for the picked bars sit above them, as in the chord chart. */}
        <div className="chart-settings">
          <span className="chart-bar-tools">
            <IconButton
              onMouseDown={keepFocus}
              icon="delete"
              label={t('chords.deleteBars')}
              disabled={locked}
              onClick={onRemove}
            />
          </span>
        </div>
        <ol
          className="chart-bars"
          aria-label={t('chords.bars')}
          onKeyDown={onGridKey}
          // Runtime geometry: how many bars sit on a line.
          style={{ '--bars-per-line': barsPerLine } as CSSProperties}
        >
          {parts.map((part, i) => (
            <li key={i}>
              <button
                type="button"
                ref={barRef(i)}
                className={cx(
                  'chart-bar',
                  i >= first && i <= last && 'chart-bar-selected',
                  i === playingBar && 'chart-bar-playing'
                )}
                aria-pressed={i >= first && i <= last}
                aria-label={t('beats.barLabel', { n: i + 1, part: beatName(beats, part) })}
                tabIndex={i === selected ? 0 : -1}
                // Shift-click picks every bar from the selected one to this one.
                onClick={(e) => select(i, false, e.shiftKey)}
              >
                <span className="chart-bar-number">{i + 1}</span>
                <span className="chart-bar-chords">
                  {/* Every bar names its part: each one plays, even when it's the same. */}
                  <span>{beatName(beats, part)}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
        <BarTools
          locked={locked}
          lineIsFull={lineIsFull}
          onAddBar={() => {
            // A new bar carries on like the one before it.
            onParts([...parts, parts.at(-1) ?? 'main'])
            pickNewBar()
          }}
          onRepeatLine={() => {
            const repeated = repeatLine(parts, selected, barsPerLine)
            onParts(repeated.bars)
            onPlace({ bar: repeated.copyAt, slot: 0 })
          }}
        />
      </div>

      <section className={cx('chord-picker', 'beats-picker', raised)} aria-label={barsText}>
        <div className="picker-head">
          <span className="beats-pad-name">
            <span className="picker-bar">{barsText}</span>
            {help}
          </span>
          {tools(false)}
        </div>
        <div className="picker-chords" role="group" aria-label={t('beats.parts')}>
          {BEAT_PARTS.map(chip)}
        </div>
        <div className="beats-mine-head">
          <span className="picker-label">{t('beats.yours')}</span>
          <span className="beats-mine-tools">
            <Button
              size="sm"
              variant="ghost"
              icon="plus"
              title={t('beats.newBeatTitle')}
              disabled={locked}
              onMouseDown={keepFocus}
              onClick={newBeat}
            >
              {t('beats.newBeat')}
            </Button>
            {(mineOverflow || searching) && (
              <IconButton
                icon="search"
                iconSize="secondary"
                label={t('beats.find')}
                aria-pressed={searching}
                onClick={() => (searching ? stopSearching() : setSearching(true))}
              />
            )}
            {editing && !renaming && (
              <IconButton
                icon="delete"
                iconSize="secondary"
                label={t('beats.deleteBeat')}
                disabled={locked}
                onMouseDown={keepFocus}
                onClick={() => onDeleteBeat(editing.n)}
              />
            )}
          </span>
        </div>
        {searching && (
          <SearchField
            label={t('beats.find')}
            placeholder={t('beats.find')}
            value={findMine}
            autoFocus
            onChange={(e) => setFindMine(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && stopSearching()}
          />
        )}
        {(beats.mine?.length ?? 0) > 0 && (
          <div
            ref={mineRow}
            className={cx('picker-chords', 'beats-mine', !searching && 'beats-mine-one-row')}
            // Runtime geometry: one line of chips.
            style={{ '--mine-line': `${chipHeight}px` } as CSSProperties}
            role="group"
            aria-label={t('beats.yours')}
          >
            {mineShown.map(mineOf).map(chip)}
            {mineShown.length === 0 && <p className="picker-none">{t('chords.noMatch')}</p>}
          </div>
        )}
        {pad(false)}
      </section>
    </div>
  )
}
