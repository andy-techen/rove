import { t } from '@shared/copy'
import { Chord } from '../../audio/music/chords'
import { SongKey } from '../../audio/pitch/key'

// One string in the copy file, so translators see the note names together.
const noteNames = (): string[] => t('tuning.noteNames').split(' ')

/** "A minor". */
export function keyName(key: SongKey): string {
  return t('tuning.keyName', { note: noteNames()[key.tonic], mode: t(`tuning.${key.mode}`) })
}

/** "Am", "F", as chord sheets write them. */
export function chordName(chord: Chord): string {
  const root = noteNames()[chord.root]
  return chord.quality === 'minor' ? t('chords.minorName', { root }) : root
}
