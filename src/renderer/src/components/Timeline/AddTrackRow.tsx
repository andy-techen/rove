import { IconName } from '../ui/Icon'
import { IconButton } from '../ui/IconButton'

export interface AddChoice {
  key: string
  /** What the choice adds: the button's accessible name and tooltip. */
  label: string
  icon: IconName
  onPick(): void
}

interface Props {
  /** What the row is for ("Add music"), shown before the choices. */
  label: string
  choices: AddChoice[]
  disabled: boolean
}

/**
 * The row under a group of lanes that adds another track. Every kind is right there, so
 * adding one is a single click.
 */
export function AddTrackRow({ label, choices, disabled }: Props): React.JSX.Element {
  return (
    <div className="lane lane-add">
      <div className="lane-header">
        <span className="add-row" role="group" aria-label={label}>
          <span className="add-row-label">{label}</span>
          {choices.map((choice) => (
            <IconButton
              key={choice.key}
              icon={choice.icon}
              iconSize="secondary"
              className="add-choice"
              label={choice.label}
              disabled={disabled}
              onClick={choice.onPick}
            />
          ))}
        </span>
      </div>
      <div className="lane-area" />
      <div className="mix-cell" />
    </div>
  )
}
