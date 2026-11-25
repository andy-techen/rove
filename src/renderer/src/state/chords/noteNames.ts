import { t } from '@shared/copy'
import { Chord } from '../../audio/music/chords'
import { SongKey } from '../../audio/pitch/key'

// One string in the copy file, so translators see the note names together.
const noteNames = (): string[] => t('tuning.noteNames').split(' ')

/** "C♯", "B♭": a pitch class (0 = C) as Rove spells it. */
export const noteName = (pitchClass: number): string => noteNames()[pitchClass]

/** "C♯3": a MIDI note as a note name and octave (60 is C4, middle C). */
export const noteWithOctave = (midi: number): string =>
  `${noteName(((midi % 12) + 12) % 12)}${Math.floor(midi / 12) - 1}`

/** "A minor". */
export function keyName(key: SongKey): string {
  return t('tuning.keyName', { note: noteNames()[key.tonic], mode: t(`tuning.${key.mode}`) })
}

/** "Am", "F", "G7", "C/E", as chord sheets write them. */
export function chordName(chord: Chord): string {
  const name = t(`chords.kinds.${chord.quality}`, { root: noteName(chord.root) })
  return chord.bass === undefined || chord.bass === chord.root
    ? name
    : t('chords.slash', { chord: name, bass: noteName(chord.bass) })
}
