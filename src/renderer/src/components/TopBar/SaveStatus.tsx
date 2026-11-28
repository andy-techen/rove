import { useEffect, useState } from 'react'
import { saveDetail, saveLabel } from '../../state/song/saveStatus'
import { SaveState } from '../../state/song/useSong'
import { cx } from '../ui/cx'
import { Tooltip } from '../ui/Tooltip'
import { REFRESH_MS } from './constants'

/** "Saving…" / "Saved just now" / "Saved 5 min ago", with the exact time on hover. */
export function SaveStatus({ state }: { state: SaveState }): React.JSX.Element {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), REFRESH_MS)
    return () => clearInterval(id)
  }, [])
  // A fresh save is always "just now", whatever the last tick said.
  const label = saveLabel(state, state.status === 'saved' ? Math.max(now, state.at) : now)
  return (
    <Tooltip text={saveDetail(state)}>
      <span className={cx('save-status', state.status)} role="status">
        {label}
      </span>
    </Tooltip>
  )
}
