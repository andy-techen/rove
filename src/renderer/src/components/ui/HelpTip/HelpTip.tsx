import { Icon } from '../Icon'
import { Tooltip } from '../Tooltip'
import './HelpTip.css'

const HELP_ICON_SIZE = 14

interface Props {
  /** The instruction, shown on hover or keyboard focus. */
  text: string
}

/** A small "?" that reveals an instruction, so help is there without cluttering the screen. */
export function HelpTip({ text }: Props): React.JSX.Element {
  return (
    <Tooltip text={text}>
      <button type="button" className="help-tip" aria-label={text}>
        <Icon name="help" size={HELP_ICON_SIZE} />
      </button>
    </Tooltip>
  )
}
