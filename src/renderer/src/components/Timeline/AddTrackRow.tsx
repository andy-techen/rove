import { useState } from 'react'
import { t } from '@shared/copy'
import { Button } from '../ui/Button'
import { IconButton } from '../ui/IconButton'

// Matches the × that removes a track, so the two read as the same kind of control.
const CANCEL_ICON_SIZE = 12

export interface AddChoice {
  key: string
  label: string
  onPick(): void
}

interface Props {
  /** The row's button ("+ Add vocal"); clicking it offers the choices. */
  label: string
  choices: AddChoice[]
  disabled: boolean
}

/** The row under a group of lanes that adds another track, asking what kind first. */
export function AddTrackRow({ label, choices, disabled }: Props): React.JSX.Element {
  const [choosing, setChoosing] = useState(false)
  return (
    <div className="lane lane-add">
      <div className="lane-header">
        <span className="add-row">
          {choosing ? (
            <>
              {choices.map((choice) => (
                <Button
                  key={choice.key}
                  variant="ghost"
                  size="sm"
                  disabled={disabled}
                  onClick={() => {
                    setChoosing(false)
                    choice.onPick()
                  }}
                >
                  {choice.label}
                </Button>
              ))}
              <IconButton
                icon="close"
                iconSize={CANCEL_ICON_SIZE}
                className="add-cancel"
                label={t('timeline.cancel')}
                onClick={() => setChoosing(false)}
              />
            </>
          ) : (
            <Button variant="ghost" size="sm" disabled={disabled} onClick={() => setChoosing(true)}>
              {label}
            </Button>
          )}
        </span>
      </div>
      <div className="lane-area" />
      <div className="mix-cell" />
    </div>
  )
}
