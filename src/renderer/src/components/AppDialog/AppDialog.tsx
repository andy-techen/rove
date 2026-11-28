import { KeyboardEvent, useRef } from 'react'
import { t } from '@shared/copy'
import { Dialog } from '../ui/Dialog'
import { cx } from '../ui/cx'
import { KeymapTable } from './KeymapTable'
import { SECTIONS, Section } from './sections'
import { PremiumSection } from './PremiumSection'
import { SettingsSection } from './SettingsSection'
import { VoiceSection } from './VoiceSection'
import './AppDialog.css'

interface SectionProps {
  onMicCheck(): void
}

const CONTENT: Record<Section, (props: SectionProps) => React.JSX.Element> = {
  voice: VoiceSection,
  settings: SettingsSection,
  premium: PremiumSection,
  shortcuts: KeymapTable
}

// Arrow keys step through the sections, wrapping round; Home and End jump to the ends.
const STEPS: Record<string, (at: number) => number> = {
  ArrowDown: (at) => (at + 1) % SECTIONS.length,
  ArrowUp: (at) => (at - 1 + SECTIONS.length) % SECTIONS.length,
  Home: () => 0,
  End: () => SECTIONS.length - 1
}

interface Props {
  section: Section
  onSection(section: Section): void
  onClose(): void
  /** Closes the dialog and opens the mic check. */
  onMicCheck(): void
}

const tabId = (section: Section): string => `app-dialog-tab-${section}`

/** One place for the singer's voice, settings, premium and shortcuts, picked from a sidebar. */
export function AppDialog({ section, onSection, onClose, onMicCheck }: Props): React.JSX.Element {
  const tabs = useRef<Partial<Record<Section, HTMLButtonElement | null>>>({})
  const Content = CONTENT[section]

  const onKeyDown = (e: KeyboardEvent): void => {
    const step = STEPS[e.key]
    if (!step) return
    e.preventDefault()
    const next = SECTIONS[step(SECTIONS.indexOf(section))]
    onSection(next)
    tabs.current[next]?.focus()
  }

  return (
    <Dialog
      title={t(`appDialog.${section}`)}
      closeLabel={t('appDialog.close')}
      onClose={onClose}
      className="app-dialog"
      fill
      sizeKey="appDialog"
    >
      <div className="app-dialog-body">
        <div
          className="app-dialog-sidebar"
          role="tablist"
          aria-label={t('appDialog.sections')}
          aria-orientation="vertical"
          onKeyDown={onKeyDown}
        >
          {SECTIONS.map((item) => (
            <button
              key={item}
              ref={(el) => {
                tabs.current[item] = el
              }}
              type="button"
              role="tab"
              id={tabId(item)}
              className={cx('app-dialog-tab', item === section && 'active')}
              aria-selected={item === section}
              aria-controls="app-dialog-panel"
              // Roving focus: Tab lands on the open section, arrows move between them.
              tabIndex={item === section ? 0 : -1}
              onClick={() => onSection(item)}
            >
              {t(`appDialog.${item}`)}
            </button>
          ))}
        </div>
        <div
          className="app-dialog-panel"
          id="app-dialog-panel"
          role="tabpanel"
          aria-labelledby={tabId(section)}
        >
          <Content onMicCheck={onMicCheck} />
        </div>
      </div>
    </Dialog>
  )
}
