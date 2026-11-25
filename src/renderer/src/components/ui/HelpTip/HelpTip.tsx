import { ReactNode } from 'react'
import { Icon } from '../Icon'
import { Tooltip } from '../Tooltip'
import './HelpTip.css'

/** One bullet: an optional term in bold ("Louder"), then what it means. */
export interface HelpItem {
  term?: string
  text: string
}

type Props =
  | {
      /** The instruction, shown on hover or keyboard focus, and its accessible name. */
      text: string
      lines?: never
      items?: never
    }
  | {
      text?: never
      /** Short paragraphs, each on its own line (a step, then the next). */
      lines?: string[]
      /** A bulleted list under the lines, for options or parts. */
      items?: HelpItem[]
    }

const itemText = ({ term, text }: HelpItem): string => (term ? `${term}: ${text}` : text)

// Read aloud as one passage, so each part ends in a full stop: bullets often don't.
const sentence = (part: string): string => (/[.!?…]$/.test(part) ? part : `${part}.`)

/** Lines, then bullets, laid out for a tooltip. */
function HelpContent({
  lines = [],
  items = []
}: {
  lines?: string[]
  items?: HelpItem[]
}): ReactNode {
  return (
    <div className="help-content">
      {lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
      {items.length > 0 && (
        <ul>
          {items.map((item) => (
            <li key={itemText(item)}>
              <span>
                {item.term && <strong>{item.term}</strong>}
                {item.term && ': '}
                {item.text}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * A small "?" that reveals help, so it's there without cluttering the screen. Plain
 * `text` for a sentence; `lines` and `items` for help that reads better broken up. The
 * screen reader hears it all as one passage.
 */
export function HelpTip(props: Props): React.JSX.Element {
  const { lines = [], items = [] } = props
  const formatted = props.text === undefined
  const text = props.text ?? [...lines, ...items.map(itemText)].map(sentence).join(' ')
  return (
    <Tooltip
      text={text}
      content={formatted ? <HelpContent lines={lines} items={items} /> : undefined}
    >
      <button type="button" className="help-tip" aria-label={text}>
        <Icon name="help" size="secondary" />
      </button>
    </Tooltip>
  )
}
