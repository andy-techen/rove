import { useState } from 'react'
import { t } from '@shared/copy'
import { PITCH_CLASSES } from '@shared/units'
import { CHORD_QUALITIES, Chord } from '../../audio/music/chords'
import { chordsMatching, sameChord } from '../../state/chords/theory/chordText'
import { chordName, noteName } from '../../state/chords/theory/noteNames'
import { raised } from '../ui/Raised'
import { SearchField } from '../ui/SearchField'
import { Segmented, SegmentedOption } from '../ui/Segmented'
import { cx } from '../ui/cx'
import { MATCHES_SHOWN } from './constants'

const ROOTS = Array.from({ length: PITCH_CLASSES }, (_, i) => i)

export interface ChordSuggestions {
  /** "In this key", or what to start with when there's no key yet. */
  label: string
  chords: Chord[]
}

interface Props {
  /** The bar (or bars) being filled: "Bar 3", "Bars 2–4". */
  barsText: string
  /** The bar's chords: none (carrying on), one, or two sharing it. */
  chords: Chord[]
  /** Which half of a split bar is being filled. */
  slot: number
  suggestions: ChordSuggestions
  locked: boolean
  onPick(chord: Chord): void
}

type Tab = 'key' | 'all'

/**
 * Choose a bar's chord: the ones in the key, or any chord at all (a root note, then
 * its kind). Two tabs, so either is a click away; search finds anything.
 */
export function ChordPicker({
  barsText,
  chords,
  slot,
  suggestions,
  locked,
  onPick
}: Props): React.JSX.Element {
  const current = chords[slot]
  const [typed, setTyped] = useState('')
  const matches = chordsMatching(typed, MATCHES_SHOWN)
  const keyRoots = new Set(suggestions.chords.map((c) => c.root))
  const inKey = !!current && suggestions.chords.some((c) => sameChord(c, current))
  // Opens on the key's chords, unless the bar already holds one from outside it.
  const [tab, setTab] = useState<Tab>(
    suggestions.chords.length === 0 || (current && !inKey) ? 'all' : 'key'
  )
  const [root, setRoot] = useState(current?.root ?? suggestions.chords[0]?.root ?? 0)

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

  const tabs: SegmentedOption<Tab>[] = [
    { value: 'key', label: suggestions.label },
    { value: 'all', label: t('chords.every') }
  ]

  return (
    <section
      className={cx('chord-picker', raised)}
      aria-label={t('chords.pickerLabel', { bars: barsText })}
    >
      <div className="picker-head">
        <span className="picker-bar">{barsText}</span>
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
            <Segmented
              className="picker-tabs"
              label={t('chords.pickerTabs')}
              options={tabs}
              value={tab}
              onChange={setTab}
            />
          )}
          {tab === 'key' ? (
            <div className="picker-row picker-chords" role="group" aria-label={suggestions.label}>
              {suggestions.chords.map(chordButton)}
            </div>
          ) : (
            <>
              <div className="picker-roots" role="group" aria-label={t('chords.roots')}>
                {ROOTS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    // The key's notes stand out: the chords most songs need start there.
                    className={cx(
                      'picker-root',
                      keyRoots.has(r) && 'picker-root-key',
                      r === root && 'picker-root-on'
                    )}
                    aria-pressed={r === root}
                    aria-label={t('chords.onRoot', { note: noteName(r) })}
                    onClick={() => setRoot(r)}
                  >
                    {noteName(r)}
                  </button>
                ))}
              </div>
              <div className="picker-row picker-chords">
                {CHORD_QUALITIES.map((quality) => chordButton({ root, quality }))}
              </div>
            </>
          )}
        </>
      )}
    </section>
  )
}
