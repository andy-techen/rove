import { useEffect } from 'react'
import { dismissSnack, useSnack } from '../../../state/ui/snackbar'
import { Icon } from '../Icon'
import { SHOW_MS } from './constants'
import './Snackbar.css'

/** Where one-off messages appear (`showSnack`): bottom left, for a few seconds. */
export function Snackbar(): React.JSX.Element {
  const snack = useSnack()

  useEffect(() => {
    if (!snack) return
    const timer = setTimeout(() => dismissSnack(snack.id), SHOW_MS)
    return () => clearTimeout(timer)
  }, [snack])

  return (
    <div className="snackbar-host" role="status" aria-live="polite">
      {snack && (
        <p key={snack.id} className="snackbar">
          <Icon name="check" size="secondary" />
          {snack.text}
        </p>
      )}
    </div>
  )
}
