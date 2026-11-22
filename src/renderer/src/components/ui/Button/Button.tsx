import { ButtonHTMLAttributes } from 'react'
import { cx } from '../cx'
import { Icon, IconName } from '../Icon'
import './Button.css'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'quiet'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: 'md' | 'sm'
  /** An icon before the label, for a text button an icon helps recognise. */
  icon?: IconName
}

const ICON_SIZE = { md: 16, sm: 14 }

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  className,
  type = 'button',
  children,
  ...rest
}: Props): React.JSX.Element {
  return (
    <button
      type={type}
      className={cx('btn', `btn-${variant}`, `btn-${size}`, icon && 'btn-with-icon', className)}
      {...rest}
    >
      {icon && <Icon name={icon} size={ICON_SIZE[size]} />}
      {children}
    </button>
  )
}
