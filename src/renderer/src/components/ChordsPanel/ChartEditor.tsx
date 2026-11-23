import { KeyboardEvent, useRef, useState } from 'react'
import { t } from '@shared/copy'
import { Chord } from '../../audio/music/chords'
import { BeatsPerBar, ChordChart } from '../../state/song/project'
import {
  MAX_CHORDS_PER_BAR,
  addBar,
  chordBefore,
  clearBar,
  joinBar,
  pasteBars,
  removeBar,
  splitBar,
  tapTempo,
  withChordAt
} from '../../state/chords/chartBars'
import { chartFromText } from '../../state/chords/chordText'
import { chordName } from '../../state/chords/noteNames'
import { parseTypedNumber } from '../ui/NumberField'
import { Button } from '../ui/Button'
import { HelpTip } from '../ui/HelpTip'
import { IconButton } from '../ui/IconButton'
import { NumberField } from '../ui/NumberField'
import { Select } from '../ui/Select'
import { cx } from '../ui/cx'
import { ChordPicker, ChordSuggestions } from './ChordPicker'

// Bars are laid out four to a line, as chord charts are written.
const BARS_PER_LINE = 4
const MS_PER_SEC = 1000

interface Props {
  chart: ChordChart
  /** The bar under the playhead, or -1. */
  playingBar: number
  suggestions: ChordSuggestions
  locked: boolean
  onBars(bars: Chord[][]): void
  onTempo(bpm: number): void
  onBeats(beatsPerBar: BeatsPerBar): void
  /** Lets the singer hear a chord as it's picked. */
  onPreview(chord: Chord): void
}

/** Writing the song's chords: tempo, beats in a bar, and a chord (or two) for each bar. */
export function ChartEditor({
  chart,
  playingBar,
  suggestions,
  locked,
  onBars,
  onTempo,
  onBeats,
  onPreview
}: Props): React.JSX.Element {
  const { bars } = chart
  const [picked, setPicked] = useState(0)
  const [slot, setSlot] = useState(0)
  const [unread, setUnread] = useState<string[]>([])
  const taps = useRef<number[]>([])
  const barRefs = useRef<(HTMLButtonElement | null)[]>([])
  const selected = Math.min(picked, bars.length - 1)

  const select = (bar: number, focus = false): void => {
    const next = Math.max(0, Math.min(bars.length - 1, bar))
    setPicked(next)
    setSlot(0)
    if (focus) barRefs.current[next]?.focus()
  }

  const pick = (chord: Chord): void => {
    onBars(withChordAt(bars, selected, slot, chord))
    onPreview(chord)
    // Straight on to the next half or bar, so a chart is a run of picks.
    if (slot === 0 && bars[selected].length > 1) setSlot(1)
    else if (selected < bars.length - 1) select(selected + 1)
  }

  const onGridKey = (e: KeyboardEvent<HTMLOListElement>): void => {
    const moves: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -BARS_PER_LINE,
      ArrowDown: BARS_PER_LINE
    }
    if (e.key in moves) {
      e.preventDefault()
      select(selected + moves[e.key], true)
    } else if ((e.key === 'Backspace' || e.key === 'Delete') && !locked) {
      e.preventDefault()
      onBars(clearBar(bars, selected))
    }
  }

  const tap = (): void => {
    taps.current = [...taps.current, performance.now() / MS_PER_SEC]
    const bpm = tapTempo(taps.current)
    if (bpm) onTempo(bpm)
  }

  const barLabel = (bar: Chord[], i: number): string =>
    t('chords.barLabel', {
      n: i + 1,
      chords: bar.length ? bar.map(chordName).join(' ') : t('chords.carryOn')
    })

  return (
    <div
      className="chart-editor"
      onPaste={(e) => {
        // Pasting into the tempo or the search is ordinary typing.
        if ((e.target as HTMLElement).closest('input') || locked) return
        const pasted = chartFromText(e.clipboardData.getData('text'))
        if (!pasted.bars.length) return
        e.preventDefault()
        onBars(pasteBars(bars, selected, pasted.bars))
        setUnread(pasted.unread)
      }}
    >
      <div className="chart-settings">
        <span className="chart-setting">
          <span className="chart-setting-label">{t('chords.tempo')}</span>
          <NumberField
            label={t('chords.tempoLabel')}
            value={String(chart.bpm)}
            unit={t('music.bpm')}
            align="start"
            disabled={locked}
            onCommit={(text) => {
              const bpm = parseTypedNumber(text)
              if (bpm !== null) onTempo(bpm)
            }}
          />
          <Button size="sm" variant="quiet" disabled={locked} onClick={tap}>
            {t('chords.tap')}
          </Button>
          <HelpTip text={t('chords.tapHelp')} />
        </span>
        <span className="chart-setting">
          <span className="chart-setting-label">{t('chords.count')}</span>
          <Select
            label={t('chords.countLabel')}
            value={String(chart.beatsPerBar)}
            options={[
              { value: '4', label: '4' },
              { value: '3', label: '3' }
            ]}
            disabled={locked}
            onChange={(v) => onBeats(v === '3' ? 3 : 4)}
          />
          <HelpTip text={t('chords.countHelp')} />
        </span>
      </div>

      <ol className="chart-bars" aria-label={t('chords.bars')} onKeyDown={onGridKey}>
        {bars.map((bar, i) => (
          <li key={i}>
            <button
              type="button"
              ref={(el) => {
                barRefs.current[i] = el
              }}
              className={cx(
                'chart-bar',
                i === selected && 'chart-bar-selected',
                i === playingBar && 'chart-bar-playing'
              )}
              aria-pressed={i === selected}
              aria-label={barLabel(bar, i)}
              tabIndex={i === selected ? 0 : -1}
              onClick={() => select(i)}
            >
              <span className="chart-bar-number">{i + 1}</span>
              <span className="chart-bar-chords">
                {bar.length ? (
                  bar
                    .slice(0, MAX_CHORDS_PER_BAR)
                    .map((c, k) => <span key={k}>{chordName(c)}</span>)
                ) : (
                  <span className="chart-bar-carry">·</span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ol>
      <div className="chart-bar-actions">
        <Button
          size="sm"
          variant="ghost"
          icon="plus"
          disabled={locked}
          onClick={() => {
            onBars(addBar(bars))
            select(bars.length)
          }}
        >
          {t('chords.addBar')}
        </Button>
        <IconButton
          icon="delete"
          label={t('chords.removeBar', { n: selected + 1 })}
          disabled={locked || bars.length <= 1}
          onClick={() => {
            onBars(removeBar(bars, selected))
            select(selected - (selected === bars.length - 1 ? 1 : 0))
          }}
        />
      </div>
      {unread.length > 0 && (
        <p className="chart-unread" role="status">
          {t('chords.unread', { names: unread.join(', ') })}
        </p>
      )}

      <ChordPicker
        key={selected}
        barNumber={selected + 1}
        chords={bars[selected]}
        slot={slot}
        onSlot={setSlot}
        suggestions={suggestions}
        locked={locked}
        onPick={pick}
        canSplit={bars[selected].length > 0 || !!chordBefore(bars, selected)}
        onSplit={() => {
          onBars(splitBar(bars, selected))
          setSlot(1)
        }}
        onJoin={() => {
          onBars(joinBar(bars, selected))
          setSlot(0)
        }}
        onClear={() => onBars(clearBar(bars, selected))}
      />
    </div>
  )
}
