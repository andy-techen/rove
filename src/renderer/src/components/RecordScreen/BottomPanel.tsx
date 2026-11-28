import { CSSProperties } from 'react'
import { t } from '@shared/copy'
import { Plan, isEnabled } from '@shared/license/features'
import type { SongKey } from '../../audio/pitch/key'
import { offersVocals } from '../../state/license/premiumControls'
import type { AutoPolishState } from '../../state/processing/useAutoPolish'
import type { VocalRemoval } from '../../state/processing/useVocalRemoval'
import {
  Project,
  Track,
  musicOf,
  polishOf,
  withMusicPitch,
  withMusicSpeed,
  withMusicTone,
  withTrackPolish
} from '../../state/song/project'
import { BOTTOM_HEIGHT, INSTRUMENTAL_MIN_HEIGHT } from '../../state/ui/constants'
import { MusicPanel } from '../MusicPanel'
import { PolishPanel } from '../PolishPanel'
import { Splitter } from '../ui/Splitter'
import { cx } from '../ui/cx'
import { InstrumentalPanel } from './InstrumentalPanel'
import type { HearBeat } from './useBeatPlayer'
import type { Instrumentals } from './useInstrumentals'

interface Props {
  /** The selected track, whose panel this shows. */
  track: Track
  project: Project
  edit(next: Project, coalesce?: string): void
  locked: boolean
  /** Nothing is playing or recording. */
  idle: boolean
  plan: Plan
  height: number
  onHeight(px: number): void
  /** A panel that grew asks for this much more height. */
  onGrow(missingPx: number): void
  onHide(): void
  /** The music's tempo and key, as heard. */
  bpm: number | null
  songKey: SongKey | null
  vocalRemoval: VocalRemoval
  autoPolish: AutoPolishState
  instrumentals: Instrumentals
  pasteNote: { trackId: string; text: string } | null
  onPasteChords(): void
  hearBeat: HearBeat
}

/** The panel under the timeline: Music, Instrumental or Polish, for the selected track. */
export function BottomPanel({
  track,
  project,
  edit,
  locked,
  idle,
  plan,
  height,
  onHeight,
  onGrow,
  onHide,
  bpm,
  songKey,
  vocalRemoval,
  autoPolish,
  instrumentals,
  pasteNote,
  onPasteChords,
  hearBeat
}: Props): React.JSX.Element {
  const { chart, beats } = instrumentals
  return (
    <div
      className={cx('bottom-panel', track.role === 'chords' && 'bottom-panel-instrumental')}
      // Runtime geometry: the height the singer dragged it to.
      style={{ '--bottom-height': `${height}px` } as CSSProperties}
    >
      <Splitter
        className="bottom-panel-edge"
        label={t('panel.height')}
        orientation="horizontal"
        value={height}
        min={track.role === 'chords' ? INSTRUMENTAL_MIN_HEIGHT : BOTTOM_HEIGHT.min}
        max={BOTTOM_HEIGHT.max}
        perPixel={-1}
        onChange={onHeight}
      />
      {track.role === 'backing' && (
        <MusicPanel
          trackName={track.name}
          music={musicOf(project)}
          bpm={bpm}
          songKey={songKey}
          locked={locked}
          onSpeed={(speed, key) => edit(withMusicSpeed(project, speed), key)}
          onSemitones={(n, key) => edit(withMusicPitch(project, n), key)}
          onTone={(tone, key) => edit(withMusicTone(project, tone), key)}
          vocals={
            offersVocals(plan, vocalRemoval.vocals)
              ? {
                  state: vocalRemoval.vocals,
                  error: vocalRemoval.error,
                  onRemove: vocalRemoval.remove,
                  onCancel: vocalRemoval.cancel,
                  onPutBack: vocalRemoval.putBack
                }
              : undefined
          }
          onHide={onHide}
          onReset={() =>
            edit(
              withMusicTone(withMusicPitch(withMusicSpeed(project, 1), 0), {
                bassDb: 0,
                brightnessDb: 0
              })
            )
          }
        />
      )}

      {track.role === 'chords' && (chart || beats) && (
        <InstrumentalPanel
          key={track.id}
          track={track}
          project={project}
          edit={edit}
          locked={locked}
          instrumentals={instrumentals}
          pasteNote={pasteNote?.trackId === track.id ? pasteNote.text : null}
          onPasteChords={onPasteChords}
          hearBeat={hearBeat}
          onHide={onHide}
        />
      )}

      {track.role === 'vocal' && (
        <PolishPanel
          key={track.id}
          trackName={track.name}
          part={track.part ?? 'lead'}
          polish={polishOf(track)}
          auto={
            isEnabled('autoPolish', plan)
              ? {
                  ...autoPolish,
                  suggestion: track.polishSuggestion ?? null,
                  disabled: !idle,
                  onListen: autoPolish.listen
                }
              : undefined
          }
          locked={locked}
          canTune={isEnabled('tuning', plan)}
          onHide={onHide}
          onGrow={onGrow}
          onChange={(next, key) =>
            edit(withTrackPolish(project, track.id, next), key ? `${key}:${track.id}` : undefined)
          }
        />
      )}
    </div>
  )
}
