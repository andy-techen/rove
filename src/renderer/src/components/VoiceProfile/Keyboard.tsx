import { noteWithOctave } from '../../state/chords/noteNames'
import { previewNote } from '../../state/chords/preview'
import type { KeyScale } from './keyboardGeometry'

const KEY_HEIGHT = 24
const LABEL_Y = 37
const LABEL_INSET = 2
const BLACK_KEYS = new Set([1, 3, 6, 8, 10])
const C = 0

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
          x={x(note)}
          width={keyWidth}
          height={KEY_HEIGHT}
          onClick={() => void previewNote(note)}
        />
      ))}
      {notes
        .filter((note) => note % 12 === C)
        .map((note) => (
          <text key={note} className="voice-chart-label" x={x(note) + LABEL_INSET} y={LABEL_Y}>
            {noteWithOctave(note)}
          </text>
        ))}
    </g>
  )
}
