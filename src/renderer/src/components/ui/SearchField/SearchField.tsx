import { InputHTMLAttributes } from 'react'
import { cx } from '../cx'
import { Icon } from '../Icon'
import './SearchField.css'

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  /** Accessible name for the search field. */
  label: string
}

/** A search input with a leading magnifying glass. */
export function SearchField({ label, className, ...rest }: Props): React.JSX.Element {
  return (
    <span className={cx('search-field', className)}>
      <Icon name="search" size="secondary" />
      <input type="search" aria-label={label} {...rest} />
    </span>
  )
}
