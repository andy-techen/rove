import { useEffect, useState } from 'react'
import { onCommand } from '../../state/commands/commands'
import { Section, sectionFor } from './sections'

interface AppDialogState {
  /** The open section, or null while the dialog is closed. */
  section: Section | null
  show(section: Section): void
  close(): void
}

/** Which section of the app dialog is open; menu commands open it at theirs. */
export function useAppDialog(): AppDialogState {
  const [section, setSection] = useState<Section | null>(null)
  useEffect(
    () =>
      onCommand((command) => {
        const target = sectionFor(command)
        if (target) setSection(target)
      }),
    []
  )
  return { section, show: setSection, close: () => setSection(null) }
}
