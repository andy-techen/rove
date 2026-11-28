import { noteWithOctave } from '../../state/chords/theory/noteNames'
import { previewNote } from '../../state/chords/instruments/preview'
import { PITCH_CLASSES } from '@shared/units'
import { C, KEY_GAP, KEY_HEIGHT, KEY_LABEL_INSET, KEY_LABEL_Y } from './constants'
import type { KeyScale } from './keyboardGeometry'

const BLACK_KEYS = new Set([1, 3, 6, 8, 10])

/**
 * A strip of piano keys, labelled at each C, so a singer can see where notes sit without
 * reading music. Drawn flat in a row (black keys as dark keys in line) to stay legible
 * at chart size. Clicking a key plays it; the note names above are the keyboard way to
 * hear the notes that matter, so the keys stay out of the Tab order.
 */
export function Keyboard({ scale, y }: { scale: KeyScale; y: number }): React.JSX.Element {
  const { keys, keyWidth, x } = scale
  const notes = Array.from({ length: keys.high - keys.low + 1 }, (_, i) => keys.low + i)
  return (
    <g className="voice-keyboard" transform={`translate(0 ${y})`} aria-hidden="true">
      {notes.map((note) => (
        <rect
          key={note}
          className={BLACK_KEYS.has(note % 12) ? 'voice-key black' : 'voice-key'}
          x={x(note) + KEY_GAP / 2}
          width={keyWidth - KEY_GAP}
          height={KEY_HEIGHT}
          onClick={() => void previewNote(note)}
        />
      ))}
      {notes
        .filter((note) => note % PITCH_CLASSES === C)
        .map((note) => (
          <text
            key={note}
            className="voice-chart-label"
            x={x(note) + KEY_LABEL_INSET}
            y={KEY_LABEL_Y}
          >
            {noteWithOctave(note)}
          </text>
        ))}
    </g>
  )
}
