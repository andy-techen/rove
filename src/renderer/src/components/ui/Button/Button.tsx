import { ButtonHTMLAttributes } from 'react'
import { cx } from '../cx'
import './Button.css'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'quiet'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: 'md' | 'sm'
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  type = 'button',
  ...rest
}: Props): React.JSX.Element {
  return (
    <button
      type={type}
      className={cx('btn', `btn-${variant}`, `btn-${size}`, className)}
      {...rest}
    />
  )
}
