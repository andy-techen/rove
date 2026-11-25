import { ReactNode } from 'react'
import { t } from '@shared/copy'
import { Instrument } from '../../state/song/project'
import { Button } from '../ui/Button'
import { Panel } from '../ui/Panel'
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

const CHOICES: Instrument[] = ['guitar', 'piano', 'beats']

/**
 * An instrumental Rove plays for you, bar by bar: a guitar or piano from the chords you
 * write, or drums. Shown when its track is selected.
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
      {CHOICES.map((id) => {
        const on = id === instrument
        return (
          <Button
            key={id}
            size="sm"
            variant={on ? 'secondary' : 'ghost'}
            aria-pressed={on}
            disabled={locked}
            onClick={() => !on && onInstrument(id)}
          >
            {t(`instrumental.${id}`)}
          </Button>
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
