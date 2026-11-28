import { CSSProperties, MouseEvent } from 'react'
import { t } from '@shared/copy'
import { Chord } from '../../audio/music/chords'
import {
  BeatsPerBar,
  ChordChart,
  ChordFeel,
  GUITAR_FEELS,
  PIANO_FEELS,
  feelsOf,
  guitarFeel,
  pianoFeel
} from '../../state/song/project'
import { ChartPlace } from '../../state/chords/chart'
import {
  MAX_CHORDS_PER_BAR,
  addBar,
  chordBefore,
  clearBars,
  fillBars,
  keepAt,
  repeatLine,
  splitBar,
  transposeBars,
  withChordAt
} from '../../state/chords/chartBars'
import { sameChord } from '../../state/chords/chordText'
import { chordName } from '../../state/chords/noteNames'
import { Button } from '../ui/Button'
import { HelpTip } from '../ui/HelpTip'
import { IconButton } from '../ui/IconButton'
import { cx } from '../ui/cx'
import { BarTools } from './BarTools'
import { ChordPicker, ChordSuggestions } from './ChordPicker'
import { useBarGrid } from './useBarGrid'

// Each instrument offers its own feels, and reads a bar set on the other as its nearest.
const FEELS = {
  guitar: { choices: GUITAR_FEELS, read: guitarFeel },
  piano: { choices: PIANO_FEELS, read: pianoFeel }
} as const

interface Props {
  /** Which instrument plays the chords, so the feels are its own. */
  instrument: 'guitar' | 'piano'
  chart: ChordChart
  /** Beats in a bar, from the song's tempo: a line holds as many bars. */
  beatsPerBar: BeatsPerBar
  /** The bar under the playhead, or -1. */
  playingBar: number
  suggestions: ChordSuggestions
  locked: boolean
  /** New bars; `feels` comes too when bars moved, so each keeps how it's played. */
  onBars(bars: Chord[][], feels?: ChordFeel[]): void
  /** What the last paste couldn't do (no chords, or chords it couldn't read). */
  pasteNote: string | null
  /** Fills bars from a chord sheet on the clipboard, from the selected bar on. */
  onPasteChords(): void
  /** Takes the picked bars out, as Delete does on the timeline. */
  onRemove(): void
  /** Bars `first` to `last` strummed or fingerpicked. */
  onFeel(first: number, last: number, feel: ChordFeel): void
  /** Lets the singer hear a chord as it's picked. */
  onPreview(chord: Chord): void
  /** The bar (and half of it) being written; a chord clicked on the timeline moves it. */
  place: ChartPlace
  onPlace(place: ChartPlace): void
}

/** Writing an instrumental's chords: a chord (or two) for each bar, and how it's played. */
export function ChartEditor({
  instrument,
  chart,
  beatsPerBar,
  playingBar,
  suggestions,
  locked,
  pasteNote,
  onPasteChords,
  onBars,
  onPreview,
  onFeel,
  onRemove,
  place,
  onPlace
}: Props): React.JSX.Element {
  const { bars } = chart
  const feels = feelsOf(chart)
  // A line holds as many bars as a bar has beats (4 in 4/4, 3 in 3/4), as charts are
  // written, so lines read as phrases.
  const barsPerLine = beatsPerBar
  const { selected, first, last, lineIsFull, select, barRef, onGridKey, pickNewBar } = useBarGrid({
    count: bars.length,
    barsPerLine,
    place,
    onPlace,
    locked,
    onRemove
  })
  // A run of bars is filled with one chord each; one bar can be split in two.
  const isRun = last > first
  const slot = isRun ? 0 : place.slot
  const setSlot = (next: number): void => onPlace({ bar: selected, slot: next })

  const pick = (chord: Chord): void => {
    if (isRun) {
      onBars(fillBars(bars, first, last, chord))
      onPreview(chord)
      return
    }
    onBars(withChordAt(bars, selected, slot, chord))
    onPreview(chord)
    // Straight on to the next half or bar, so a chart is a run of picks.
    if (slot === 0 && bars[selected].length > 1) setSlot(1)
    else if (selected < bars.length - 1) select(selected + 1)
  }

  // What "keep" makes of the selection: a split bar's half keeps the chord before it.
  const isHalf = !isRun && bars[selected].length > 1
  const keptBefore = isHalf && slot === 1 ? bars[selected][0] : chordBefore(bars, first)
  const kept = isHalf
    ? keepAt(bars, selected, slot)
    : bars.slice(first, last + 1).some((bar) => bar.length > 0)
      ? clearBars(bars, first, last)
      : undefined

  const barsText = isRun
    ? t('chords.barRange', { from: first + 1, to: last + 1 })
    : isHalf
      ? t('chords.halfNumber', { n: selected + 1, k: slot + 1 })
      : t('chords.barNumber', { n: selected + 1 })

  // An empty bar plays no new chord: the one before it keeps ringing (or nothing yet).
  const keepText = (carried: Chord | undefined): string =>
    carried ? t('chords.keep', { chord: chordName(carried) }) : t('chords.noChordHere')

  const keptName = (i: number): string => {
    const before = chordBefore(bars, i)
    return before ? chordName(before) : t('chords.noChord')
  }

  const halfLabel = (chord: Chord, i: number, k: number): string =>
    t('chords.halfLabel', { n: i + 1, k: k + 1, chord: chordName(chord) })

  // A click on a bar tool leaves focus in the bars, so the next key still edits them and
  // the tool doesn't sit there outlined. Tab still reaches the tools.
  const keepFocus = (e: MouseEvent): void => e.preventDefault()

  const barLabel = (bar: Chord[], i: number): string =>
    t('chords.barLabel', {
      n: i + 1,
      chords: bar.length ? bar.map(chordName).join(' ') : keepText(chordBefore(bars, i))
    })

  return (
    <div className="chart-editor">
      <div className="chart-sheet">
        <div className="chart-settings">
          <span className="chart-bar-tools">
            <span className="feel-choice" role="group" aria-label={t('instrumental.feel')}>
              {FEELS[instrument].choices.map((feel) => (
                <IconButton
                  onMouseDown={keepFocus}
                  key={feel}
                  icon={feel}
                  label={t(`instrumental.${feel}`)}
                  aria-pressed={feels
                    .slice(first, last + 1)
                    .every((f) => FEELS[instrument].read(f) === feel)}
                  disabled={locked}
                  onClick={() => onFeel(first, last, feel)}
                />
              ))}
            </span>
            <span className="chart-tools-divider" aria-hidden="true" />
            {/* Bars stay where they are, so each keeps how it's played. */}
            <IconButton
              onMouseDown={keepFocus}
              icon="keyDown"
              label={t('chords.lowerKey')}
              disabled={locked}
              onClick={() => onBars(transposeBars(bars, -1))}
            />
            <IconButton
              onMouseDown={keepFocus}
              icon="keyUp"
              label={t('chords.raiseKey')}
              disabled={locked}
              onClick={() => onBars(transposeBars(bars, 1))}
            />
            <span className="chart-tools-divider" aria-hidden="true" />
            <IconButton
              onMouseDown={keepFocus}
              icon="split"
              label={t('chords.split')}
              disabled={
                locked ||
                isRun ||
                bars[selected].length > 1 ||
                !(bars[selected].length > 0 || chordBefore(bars, selected))
              }
              onClick={() => {
                onBars(splitBar(bars, selected))
                // On to the new half, ready for its chord.
                setSlot(1)
              }}
            />
            <IconButton
              onMouseDown={keepFocus}
              icon="keep"
              label={keepText(keptBefore)}
              disabled={locked || !kept}
              onClick={() => kept && onBars(kept)}
            />
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
          {bars.map((bar, i) => (
            <li key={i}>
              {bar.length > 1 ? (
                // A split bar shows as two boxes, each picked on its own.
                <span className="chart-bar-halves">
                  {bar.slice(0, MAX_CHORDS_PER_BAR).map((chord, k) => (
                    <button
                      key={k}
                      type="button"
                      ref={k === 0 ? barRef(i) : undefined}
                      className={cx(
                        'chart-bar',
                        (isRun ? i >= first && i <= last : i === selected && k === slot) &&
                          'chart-bar-selected',
                        i === playingBar && 'chart-bar-playing'
                      )}
                      aria-pressed={isRun ? i >= first && i <= last : i === selected && k === slot}
                      aria-label={halfLabel(chord, i, k)}
                      tabIndex={i === selected && k === slot ? 0 : -1}
                      onClick={(e) =>
                        e.shiftKey ? select(i, false, true) : onPlace({ bar: i, slot: k })
                      }
                    >
                      <span className="chart-bar-number">
                        {t('chords.half', { n: i + 1, k: k + 1 })}
                      </span>
                      <span className="chart-bar-chords">
                        {/* A second half that's still the first chord keeps it ringing. */}
                        <span
                          className={cx(k === 1 && sameChord(chord, bar[0]) && 'chart-bar-carry')}
                        >
                          {chordName(chord)}
                        </span>
                      </span>
                    </button>
                  ))}
                </span>
              ) : (
                <button
                  type="button"
                  ref={barRef(i)}
                  className={cx(
                    'chart-bar',
                    i >= first && i <= last && 'chart-bar-selected',
                    i === playingBar && 'chart-bar-playing'
                  )}
                  aria-pressed={i >= first && i <= last}
                  aria-label={barLabel(bar, i)}
                  tabIndex={i === selected ? 0 : -1}
                  // Shift-click picks every bar from the selected one to this one.
                  onClick={(e) => select(i, false, e.shiftKey)}
                >
                  <span className="chart-bar-number">{i + 1}</span>
                  <span className="chart-bar-chords">
                    {bar.length ? (
                      <span>{chordName(bar[0])}</span>
                    ) : (
                      // Still named, in a softer colour: it keeps ringing, it isn't silent.
                      <span className="chart-bar-carry">{keptName(i)}</span>
                    )}
                  </span>
                </button>
              )}
            </li>
          ))}
        </ol>
        <BarTools
          locked={locked}
          lineIsFull={lineIsFull}
          onAddBar={() => {
            // A new bar is played like the one before it.
            onBars(addBar(bars), [...feels, feels.at(-1) ?? 'strum'])
            pickNewBar()
          }}
          onRepeatLine={() => {
            const repeated = repeatLine(bars, selected, barsPerLine)
            onBars(repeated.bars, repeatLine(feels, selected, barsPerLine).bars)
            onPlace({ bar: repeated.copyAt, slot: 0 })
          }}
        >
          <span className="chart-paste">
            <Button
              size="sm"
              variant="ghost"
              icon="paste"
              disabled={locked}
              onClick={onPasteChords}
            >
              {t('chords.pasteChords')}
            </Button>
            <HelpTip lines={[t('chords.pasteChordsHelp.copy'), t('chords.pasteChordsHelp.bars')]} />
          </span>
        </BarTools>
        {pasteNote && (
          <p className="chart-unread" role="status">
            {pasteNote}
          </p>
        )}
      </div>

      <ChordPicker
        key={`${first}-${last}`}
        barsText={barsText}
        chords={isRun ? [] : bars[selected]}
        slot={slot}
        suggestions={suggestions}
        locked={locked}
        onPick={pick}
      />
    </div>
  )
}
