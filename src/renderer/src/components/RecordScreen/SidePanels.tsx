import { CSSProperties, ComponentProps, useRef } from 'react'
import { t } from '@shared/copy'
import { Project, nudgeLyrics, withLyrics } from '../../state/song/project'
import { useSidePanelSize } from '../../state/ui/sidePanels'
import { PANEL_MIN_HEIGHT, SIDE_WIDTH } from '../../state/ui/constants'
import { useElementHeight } from '../../state/ui/useElementHeight'
import { ChordsPanel } from '../ChordsPanel'
import { LyricsPanel } from '../LyricsPanel'
import { Splitter } from '../ui/Splitter'
import { cx } from '../ui/cx'

interface Props {
  project: Project
  edit(next: Project, coalesce?: string): void
  lyricsOpen: boolean
  chordsOpen: boolean
  onCloseLyrics(): void
  onCloseChords(): void
  /** Lyrics can't change while recording or saving. */
  lyricsLocked: boolean
  position: number
  onSeek(sec: number): void
  /** The chords the Chords panel lists: the chart's, or those heard in the music. */
  chords: ComponentProps<typeof ChordsPanel>['chords']
  hasMusic: boolean
  fromChart: boolean
}

/** The column beside the timeline: lyrics over chords, each when open. */
export function SidePanels({
  project,
  edit,
  lyricsOpen,
  chordsOpen,
  onCloseLyrics,
  onCloseChords,
  lyricsLocked,
  position,
  onSeek,
  chords,
  hasMusic,
  fromChart
}: Props): React.JSX.Element {
  const panels = useSidePanelSize()
  const sideRef = useRef<HTMLDivElement>(null)
  const sideHeight = useElementHeight(sideRef)
  // Lyrics take half the column until the divider is moved, and always leave chords room.
  const lyricsHeight = Math.max(
    PANEL_MIN_HEIGHT,
    Math.min(panels.lyricsHeight ?? sideHeight / 2, sideHeight - PANEL_MIN_HEIGHT)
  )
  return (
    <div
      className="side-panels"
      ref={sideRef}
      // Runtime geometry: the sizes the singer dragged to.
      style={
        {
          '--side-width': `${panels.width}px`,
          '--lyrics-height': `${lyricsHeight}px`
        } as CSSProperties
      }
    >
      <Splitter
        className="side-panels-edge"
        label={t('sidePanels.width')}
        orientation="vertical"
        value={panels.width}
        min={SIDE_WIDTH.min}
        max={SIDE_WIDTH.max}
        perPixel={-1}
        onChange={panels.setWidth}
      />
      {lyricsOpen && (
        <div className={cx('side-panel-slot', chordsOpen && 'side-panel-top')}>
          <LyricsPanel
            songName={project.name}
            lyrics={project.lyrics}
            position={position}
            locked={lyricsLocked}
            onSeek={onSeek}
            onChange={(lyrics) => edit(withLyrics(project, lyrics))}
            onNudge={(bySec) => edit(nudgeLyrics(project, bySec), 'lyrics-offset')}
            onClose={onCloseLyrics}
          />
        </div>
      )}
      {lyricsOpen && chordsOpen && (
        <Splitter
          className="side-panels-split"
          label={t('sidePanels.split')}
          orientation="horizontal"
          value={lyricsHeight}
          min={PANEL_MIN_HEIGHT}
          max={Math.max(PANEL_MIN_HEIGHT, sideHeight - PANEL_MIN_HEIGHT)}
          perPixel={1}
          onChange={panels.setLyricsHeight}
        />
      )}
      {chordsOpen && (
        <div className="side-panel-slot">
          <ChordsPanel
            chords={chords}
            hasMusic={hasMusic}
            fromChart={fromChart}
            position={position}
            onSeek={onSeek}
            onClose={onCloseChords}
          />
        </div>
      )}
    </div>
  )
}
