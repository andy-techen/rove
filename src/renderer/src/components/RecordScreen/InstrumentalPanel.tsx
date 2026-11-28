import { barsUntil } from '../../state/chords/instruments/beats'
import { barGrid, transposeChord } from '../../state/chords/chart/chart'
import { previewChord, previewDrum } from '../../state/chords/instruments/preview'
import {
  Project,
  Track,
  instrumentOf,
  musicOf,
  tempoOf,
  withBeatParts,
  withChartBars,
  withChartFeel,
  withInstrument,
  withMyBeat,
  withoutMyBeat
} from '../../state/song/project'
import { songEnd } from '../../state/song/selectors'
import { BeatsEditor, ChartEditor, ChordBackingPanel } from '../ChordBackingPanel'
import { FALLBACK_SEC_PER_BEAT } from './constants'
import type { Instrumentals } from './useInstrumentals'
import type { HearBeat } from './useBeatPlayer'

interface Props {
  track: Track
  project: Project
  edit(next: Project): void
  locked: boolean
  instrumentals: Instrumentals
  /** What the last paste into this chart couldn't do. */
  pasteNote: string | null
  onPasteChords(): void
  hearBeat: HearBeat
  onHide(): void
}

/** The Instrumental panel: the chords or drums of the selected instrumental track. */
export function InstrumentalPanel({
  track,
  project,
  edit,
  locked,
  instrumentals,
  pasteNote,
  onPasteChords,
  hearBeat,
  onHide
}: Props): React.JSX.Element {
  const { beats, chart, place, pickPlace, playingBar } = instrumentals
  const beatsPerBar = tempoOf(project).beatsPerBar
  return (
    <ChordBackingPanel
      trackName={track.name}
      instrument={instrumentOf(track)}
      locked={locked}
      onInstrument={(instrument) =>
        // New drums run as long as the song.
        edit(withInstrument(project, track.id, instrument, barsUntil(project, songEnd(project))))
      }
      onHide={onHide}
    >
      {beats ? (
        <BeatsEditor
          beats={beats}
          beatsPerBar={beatsPerBar}
          secPerBeat={barGrid(project, 1)?.secPerBeat ?? FALLBACK_SEC_PER_BEAT}
          playingBar={playingBar}
          locked={locked}
          onParts={(parts) => edit(withBeatParts(project, track.id, parts))}
          onMyBeat={(beat, parts) => {
            const made = withMyBeat(project, track.id, beat)
            edit(parts ? withBeatParts(made, track.id, parts) : made)
          }}
          onPreviewDrum={(drum) => void previewDrum(drum)}
          onDeleteBeat={(n) => edit(withoutMyBeat(project, track.id, n))}
          onHear={(part, onEnded) => hearBeat(project, beats, part, onEnded)}
          onRemove={() => instrumentals.removePicked(track.id)}
          place={place}
          onPlace={pickPlace}
        />
      ) : (
        chart && (
          <ChartEditor
            pasteNote={pasteNote}
            onPasteChords={onPasteChords}
            instrument={instrumentOf(track) === 'piano' ? 'piano' : 'guitar'}
            onFeel={(first, last, feel) =>
              edit(withChartFeel(project, track.id, first, last, feel))
            }
            place={place}
            onPlace={pickPlace}
            onRemove={() => instrumentals.removePicked(track.id)}
            chart={chart}
            playingBar={playingBar}
            suggestions={instrumentals.suggestions}
            locked={locked}
            onBars={(bars, feels) => edit(withChartBars(project, track.id, bars, feels))}
            beatsPerBar={beatsPerBar}
            // Heard as it will play: in the key the Key knob moved it to.
            onPreview={(chord) =>
              void previewChord(
                transposeChord(chord, musicOf(project).semitones),
                instrumentOf(track)
              )
            }
          />
        )
      )}
    </ChordBackingPanel>
  )
}
