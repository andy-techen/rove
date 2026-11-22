import { CSSProperties, useRef, useState } from 'react'

interface Props {
  /** The name being edited; the field starts with it selected. */
  initial: string
  /** Accessible name for the field. */
  label: string
  maxLength: number
  className?: string
  style?: CSSProperties
  /** Enter or clicking away: the new name, if it isn't blank. */
  onSave(name: string): void
  /** Esc, or a blank name: editing ends with the name unchanged. */
  onDone(): void
}

/** Edits a name in place: Enter or clicking away saves, Esc cancels. */
export function NameField({
  initial,
  label,
  maxLength,
  className,
  style,
  onSave,
  onDone
}: Props): React.JSX.Element {
  const [draft, setDraft] = useState(initial)
  // Enter saves and the field unmounts, which can also fire blur; only finish once.
  const finished = useRef(false)
  const finish = (save: boolean): void => {
    if (finished.current) return
    finished.current = true
    if (save && draft.trim()) onSave(draft)
    onDone()
  }

  return (
    <input
      className={className}
      style={style}
      aria-label={label}
      value={draft}
      maxLength={maxLength}
      autoFocus
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') finish(true)
        if (e.key === 'Escape') finish(false)
      }}
    />
  )
}
