import { useState } from 'react'
import { t } from '@shared/copy'
import { CHORD_QUALITIES, Chord } from '../../audio/music/chords'
import { PITCH_CLASSES } from '../../audio/pitch/key'
import { chordsMatching, sameChord } from '../../state/chords/chordText'
import { chordName, noteName } from '../../state/chords/noteNames'
import { Button } from '../ui/Button'
import { SearchField } from '../ui/SearchField'
import { cx } from '../ui/cx'

// As many matches as fit one row of the picker.
const MATCHES_SHOWN = 8
const ROOTS = Array.from({ length: PITCH_CLASSES }, (_, i) => i)

export interface ChordSuggestions {
  /** "In this key", or what to start with when there's no key yet. */
  label: string
  chords: Chord[]
}

interface Props {
  /** The bar being filled, counted from 1. */
  barNumber: number
  /** The bar's chords: none (carrying on), one, or two sharing it. */
  chords: Chord[]
  /** Which half of a shared bar a pick goes into. */
  slot: number
  onSlot(slot: number): void
  suggestions: ChordSuggestions
  locked: boolean
  onPick(chord: Chord): void
  /** There's a chord to share the bar with (in it, or carried on into it). */
  canSplit: boolean
  onSplit(): void
  onJoin(): void
  onClear(): void
}

/** Choose a bar's chord from a list: the ones that fit the key, or any chord at all. */
export function ChordPicker({
  barNumber,
  chords,
  slot,
  onSlot,
  suggestions,
  locked,
  onPick,
  canSplit,
  onSplit,
  onJoin,
  onClear
}: Props): React.JSX.Element {
  const current = chords[slot]
  const [root, setRoot] = useState(current?.root ?? suggestions.chords[0]?.root ?? 0)
  const [typed, setTyped] = useState('')
  const matches = chordsMatching(typed, MATCHES_SHOWN)

  const chordButton = (chord: Chord): React.JSX.Element => (
    <button
      key={chordName(chord)}
      type="button"
      className={cx('picker-chord', sameChord(chord, current) && 'picker-chord-on')}
      aria-pressed={sameChord(chord, current)}
      disabled={locked}
      onClick={() => {
        setTyped('')
        setRoot(chord.root)
        onPick(chord)
      }}
    >
      {chordName(chord)}
    </button>
  )

  return (
    <section className="chord-picker" aria-label={t('chords.pickerLabel', { n: barNumber })}>
      <div className="picker-head">
        <span className="picker-bar">{t('chords.barNumber', { n: barNumber })}</span>
        {chords.length > 1 && (
          <span className="picker-halves" role="group" aria-label={t('chords.halves')}>
            {[0, 1].map((half) => (
              <button
                key={half}
                type="button"
                className={cx('picker-half', slot === half && 'picker-half-on')}
                aria-pressed={slot === half}
                onClick={() => onSlot(half)}
              >
                {t(half === 0 ? 'chords.firstHalf' : 'chords.secondHalf')}
              </button>
            ))}
          </span>
        )}
      </div>

      <SearchField
        label={t('chords.find')}
        placeholder={t('chords.findPlaceholder')}
        value={typed}
        disabled={locked}
        onChange={(e) => setTyped(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && matches[0]) {
            setTyped('')
            onPick(matches[0])
          }
        }}
      />

      {typed ? (
        <div className="picker-row picker-chords">
          {matches.length ? (
            matches.map(chordButton)
          ) : (
            <p className="picker-none">{t('chords.noMatch')}</p>
          )}
        </div>
      ) : (
        <>
          {suggestions.chords.length > 0 && (
            <>
              <h3 className="picker-label">{suggestions.label}</h3>
              <div className="picker-row picker-chords">{suggestions.chords.map(chordButton)}</div>
            </>
          )}
          <h3 className="picker-label">{t('chords.every')}</h3>
          <div className="picker-roots" role="group" aria-label={t('chords.roots')}>
            {ROOTS.map((r) => (
              <button
                key={r}
                type="button"
                className={cx('picker-root', r === root && 'picker-root-on')}
                aria-pressed={r === root}
                aria-label={t('chords.onRoot', { note: noteName(r) })}
                onClick={() => setRoot(r)}
              >
                {noteName(r)}
              </button>
            ))}
          </div>
          <div className="picker-row picker-chords picker-kinds">
            {CHORD_QUALITIES.map((quality) => chordButton({ root, quality }))}
          </div>
        </>
      )}

      <div className="picker-actions">
        {chords.length > 1 ? (
          <Button size="sm" variant="quiet" icon="minus" disabled={locked} onClick={onJoin}>
            {t('chords.join')}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="quiet"
            icon="split"
            disabled={locked || !canSplit}
            onClick={onSplit}
          >
            {t('chords.split')}
          </Button>
        )}
        <Button
          size="sm"
          variant="quiet"
          disabled={locked || chords.length === 0}
          onClick={onClear}
        >
          {t('chords.carryOn')}
        </Button>
      </div>
    </section>
  )
}
