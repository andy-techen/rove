import { ReactNode } from 'react'
import { Icon } from '../Icon'
import { Tooltip } from '../Tooltip'
import './HelpTip.css'

interface Props {
  /** The instruction, shown on hover or keyboard focus, and its accessible name. */
  text: string
  /** Formatted help shown in place of `text` (see Tooltip). */
  content?: ReactNode
}

/** A small "?" that reveals an instruction, so help is there without cluttering the screen. */
export function HelpTip({ text, content }: Props): React.JSX.Element {
  return (
    <Tooltip text={text} content={content}>
      <button type="button" className="help-tip" aria-label={text}>
        <Icon name="help" size="secondary" />
      </button>
    </Tooltip>
  )
}
