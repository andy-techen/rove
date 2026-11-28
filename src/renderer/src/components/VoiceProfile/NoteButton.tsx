import { t } from '@shared/copy'
import { noteWithOctave } from '../../state/chords/theory/noteNames'
import { previewNote } from '../../state/chords/instruments/preview'
import { Icon } from '../ui/Icon'

/** A note name that plays the note on the piano when clicked; a dash when there's none. */
export function NoteButton({ note }: { note: number | null }): React.JSX.Element {
  if (note === null) return <>–</>
  const name = noteWithOctave(note)
  return (
    <button
      type="button"
      className="voice-note"
      aria-label={t('voice.playNote', { note: name })}
      onClick={() => void previewNote(note)}
    >
      {name}
      <Icon name="volume" size="secondary" />
    </button>
  )
}
