import { ReactNode } from 'react'
import { t } from '@shared/copy'
import { Instrument } from '../../state/song/project'
import { Button } from '../ui/Button'
import { Panel } from '../ui/Panel'
import { Tooltip } from '../ui/Tooltip'
import './ChordBackingPanel.css'

interface Props {
  /** The track's name, after the title ("Backing 2"). */
  trackName: string
  instrument: Instrument
  locked: boolean
  onInstrument(instrument: Instrument): void
  onHide(): void
  /** What the instrument plays: its chords, or its drums. */
  children: ReactNode
}

// Guitar and beats play today; piano is on the way (docs/plans/chord-backing.md).
const CHOICES: { id: Instrument | 'piano'; ready: boolean }[] = [
  { id: 'guitar', ready: true },
  { id: 'piano', ready: false },
  { id: 'beats', ready: true }
]

/**
 * An instrumental Rove plays for you, bar by bar: a guitar from the chords you write, or
 * drums. Shown when its track is selected.
 */
export function ChordBackingPanel({
  trackName,
  instrument,
  locked,
  onInstrument,
  onHide,
  children
}: Props): React.JSX.Element {
  const instruments = (
    <div className="instrument-choice" role="group" aria-label={t('instrumental.instrument')}>
      {CHOICES.map(({ id, ready }) => {
        const on = id === instrument
        const button = (
          <Button
            key={id}
            size="sm"
            variant={on ? 'secondary' : 'ghost'}
            aria-pressed={on}
            disabled={!ready || locked}
            onClick={() => id !== 'piano' && !on && onInstrument(id)}
          >
            {t(`instrumental.${id}`)}
          </Button>
        )
        return ready ? (
          button
        ) : (
          <Tooltip key={id} text={t('instrumental.soon')}>
            {button}
          </Tooltip>
        )
      })}
    </div>
  )
  return (
    <Panel
      className="chord-backing-panel"
      label={t('instrumental.title')}
      title={t('instrumental.title')}
      subject={trackName}
      actions={instruments}
      onHide={onHide}
    >
      {children}
    </Panel>
  )
}
