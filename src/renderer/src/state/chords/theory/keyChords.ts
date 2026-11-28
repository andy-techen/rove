import { Chord, ChordQuality } from '../../../audio/music/chords'
import { KEY_MODES, SongKey } from '../../../audio/pitch/key'
import { PITCH_CLASSES } from '@shared/units'
import { HOME_BONUS } from './constants'

// The six chords most songs in a key are built from, by scale step. Minor keys take
// the chords of their relative major (i, III, iv, v, VI, VII), so A minor offers the
// same six as C major, starting from Am.
const STEPS: Record<SongKey['mode'], [number, ChordQuality][]> = {
  major: [
    [0, 'major'],
    [2, 'minor'],
    [4, 'minor'],
    [5, 'major'],
    [7, 'major'],
    [9, 'minor']
  ],
  minor: [
    [0, 'minor'],
    [3, 'major'],
    [5, 'minor'],
    [7, 'minor'],
    [8, 'major'],
    [10, 'major']
  ]
}

/** The chords that fit a key, home chord first: C, Dm, Em, F, G, Am for C major. */
export const chordsInKey = (key: SongKey): Chord[] =>
  STEPS[key.mode].map(([step, quality]) => ({
    root: (key.tonic + step) % PITCH_CLASSES,
    quality
  }))

/** Whether a chord is major- or minor-sounding, for matching it against a key. */
const triadOf = (quality: ChordQuality): ChordQuality | null =>
  quality === 'minor' || quality === 'm7' ? 'minor' : quality === 'dim' ? null : 'major'

/**
 * The key a chart is most likely in: the one whose chords cover the most of its bars,
 * leaning toward a key whose home chord starts or ends it. Null for an empty chart.
 */
export function keyOfChart(bars: Chord[][]): SongKey | null {
  const chords = bars.flat()
  if (chords.length === 0) return null
  const keys = KEY_MODES.flatMap((mode) =>
    Array.from({ length: PITCH_CLASSES }, (_, tonic): SongKey => ({ tonic, mode }))
  )
  const isHome = (key: SongKey, chord: Chord | undefined): boolean =>
    !!chord && chord.root === key.tonic && triadOf(chord.quality) === key.mode
  const score = (key: SongKey): number => {
    const fits = chordsInKey(key)
    const inKey = chords.filter((c) =>
      fits.some((f) => f.root === c.root && f.quality === triadOf(c.quality))
    ).length
    return (
      inKey +
      (isHome(key, chords[0]) ? HOME_BONUS : 0) +
      (isHome(key, chords.at(-1)) ? HOME_BONUS : 0)
    )
  }
  // Earlier keys win ties: major before minor, C before C♯.
  return keys.reduce((best, key) => (score(key) > score(best) ? key : best))
}
