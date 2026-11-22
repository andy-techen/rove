import { ButtonHTMLAttributes } from 'react'
import { cx } from '../cx'
import { Icon, IconName } from '../Icon'
import { Tooltip } from '../Tooltip'
import './IconButton.css'

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'title'> {
  icon: IconName
  /** Accessible name; also the tooltip unless `title` is given. */
  label: string
  /** Tooltip text, when it should say more than the name (e.g. a shortcut). */
  title?: string
  iconSize?: number
}

/** A button that shows only an icon. Always has an accessible name. */
export function IconButton({
  icon,
  label,
  iconSize,
  title,
  className,
  type = 'button',
  ...rest
}: Props): React.JSX.Element {
  return (
    <Tooltip text={title ?? label}>
      <button type={type} aria-label={label} className={cx('icon-button', className)} {...rest}>
        <Icon name={icon} size={iconSize} />
      </button>
    </Tooltip>
  )
}
