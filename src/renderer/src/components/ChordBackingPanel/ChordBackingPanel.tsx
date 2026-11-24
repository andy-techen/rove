import { t } from '@shared/copy'
import { Button } from '../ui/Button'
import { Panel } from '../ui/Panel'
import { Tooltip } from '../ui/Tooltip'
import { ChartEditor } from './ChartEditor'
import './ChordBackingPanel.css'

type Props = Parameters<typeof ChartEditor>[0] & {
  /** The track's name, after the title ("Backing 2"). */
  trackName: string
  onHide(): void
}

// Guitar plays today; piano and beats are on the way (docs/plans/chord-backing.md).
const INSTRUMENTS = [
  { id: 'guitar', ready: true },
  { id: 'piano', ready: false },
  { id: 'beats', ready: false }
] as const

/**
 * An instrumental Rove plays for you from the chords you write, bar by bar. Shown when
 * its track is selected.
 */
export function ChordBackingPanel({ trackName, onHide, ...editor }: Props): React.JSX.Element {
  const instruments = (
    <div className="instrument-choice" role="group" aria-label={t('instrumental.instrument')}>
      {INSTRUMENTS.map(({ id, ready }) => {
        const button = (
          <Button
            key={id}
            size="sm"
            variant={id === 'guitar' ? 'secondary' : 'ghost'}
            aria-pressed={id === 'guitar'}
            disabled={!ready}
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
      <ChartEditor {...editor} />
    </Panel>
  )
}
