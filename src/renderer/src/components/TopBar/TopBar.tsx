import { useState } from 'react'
import { t } from '@shared/copy'
import { IconButton } from '../ui/IconButton'
import { Theme, nextTheme } from '@shared/appearance'
import { useTheme } from '../../state/colorScheme'
import { IconName } from '../ui/Icon'
import { useShortcuts } from '../../state/shortcuts'
import { useFullScreen } from '../../state/useFullScreen'
import { cx } from '../ui/cx'
import { Tooltip } from '../ui/Tooltip'
import { SaveState } from '../../state/useSong'
import { indexForSlot } from '../../state/tabOrder'
import { SaveStatus } from './SaveStatus'
import { SongName } from './SongName'
import './TopBar.css'

export interface TabInfo {
  id: string
  name: string
}

interface Props {
  tabs: TabInfo[]
  activeId: string
  /** Locked while recording or saving: no switching songs mid-take. */
  disabled: boolean
  /** The active song's save state, shown at the right of the bar. */
  saveState: SaveState | null
  onRename(name: string): void
  onSwitch(tabId: string): void
  /** Drag a tab to a new place. */
  onMove(tabId: string, toIndex: number): void
  onClose(tabId: string): void
  onNew(): void
  onSave(): void
  /** Nothing recorded or added yet means nothing to export. */
  canExport: boolean
  onExport(): void
}

const TAB_ICON_SIZE = 14

const THEME_ICONS: Record<Theme, IconName> = { system: 'contrast', light: 'sun', dark: 'moon' }

/** The open songs as tabs. App-wide actions live in the native menu bar. */
export function TopBar({
  tabs,
  activeId,
  disabled,
  saveState,
  onRename,
  onSwitch,
  onMove,
  onClose,
  onNew,
  onSave,
  canExport,
  onExport
}: Props): React.JSX.Element {
  const { theme, setTheme } = useTheme()
  // The tab being dragged, and the gap it would drop into (0 is before the first tab).
  const [drag, setDrag] = useState<{ from: number; slot: number | null } | null>(null)
  const endDrag = (): void => setDrag(null)
  // Only mark a gap the tab would actually move to.
  const dropSlot =
    drag && drag.slot !== null && indexForSlot(drag.from, drag.slot) !== drag.from
      ? drag.slot
      : null
  const shortcuts = useShortcuts()
  const closable = tabs.length > 1
  // On macOS the bar doubles as the title bar (see titleBarStyle in the main process),
  // leaving room for the window buttons, which macOS hides in full screen.
  const isMac = window.api.platform === 'darwin'
  const fullScreen = useFullScreen()
  return (
    <header className={cx('topbar', isMac && 'titlebar', isMac && !fullScreen && 'window-buttons')}>
      <span className="brand">{t('app.name')}</span>
      <nav className="tabs" role="tablist" aria-label={t('topBar.tabsLabel')}>
        {tabs.map((tab, index) => {
          const active = tab.id === activeId
          return (
            <div
              key={tab.id}
              role="tab"
              aria-selected={active}
              className={cx(
                'tab',
                active && 'active',
                drag?.from === index && 'dragging',
                dropSlot === index && 'drop-before',
                dropSlot === tabs.length && index === tabs.length - 1 && 'drop-after'
              )}
              draggable={!disabled}
              onDragStart={(e) => {
                // Typing a new name drags text, not the tab.
                if (e.target instanceof HTMLInputElement) return
                if (e.dataTransfer) {
                  e.dataTransfer.effectAllowed = 'move'
                  // Carry the whole tab, held where it was grabbed, rather than the
                  // browser's default of whatever text or button was under the pointer.
                  const box = e.currentTarget.getBoundingClientRect()
                  e.dataTransfer.setDragImage?.(
                    e.currentTarget,
                    e.clientX - box.left,
                    e.clientY - box.top
                  )
                }
                setDrag({ from: index, slot: null })
              }}
              onDragOver={(e) => {
                if (!drag) return
                e.preventDefault()
                const box = e.currentTarget.getBoundingClientRect()
                const after = e.clientX > box.left + box.width / 2
                const slot = index + (after ? 1 : 0)
                if (slot !== drag.slot) setDrag({ ...drag, slot })
              }}
              onDrop={(e) => {
                e.preventDefault()
                if (drag?.slot != null)
                  onMove(tabs[drag.from].id, indexForSlot(drag.from, drag.slot))
                endDrag()
              }}
              onDragEnd={endDrag}
            >
              {active ? (
                <SongName name={tab.name} disabled={disabled} onRename={onRename} />
              ) : (
                <Tooltip text={tab.name}>
                  <button
                    type="button"
                    className="tab-name"
                    disabled={disabled}
                    onClick={() => onSwitch(tab.id)}
                  >
                    {tab.name}
                  </button>
                </Tooltip>
              )}
              {closable && (
                <IconButton
                  icon="close"
                  iconSize={TAB_ICON_SIZE}
                  className="tab-close"
                  label={t('topBar.close', { name: tab.name })}
                  title={t('topBar.closeTitle')}
                  disabled={disabled}
                  onClick={() => onClose(tab.id)}
                />
              )}
            </div>
          )
        })}
        <IconButton
          icon="plus"
          iconSize={TAB_ICON_SIZE}
          label={t('topBar.newSong')}
          disabled={disabled}
          onClick={onNew}
        />
      </nav>
      {saveState && (
        // Actions sit left of the status so the status stays flush right as more are added.
        <div className="topbar-actions">
          <IconButton
            icon={THEME_ICONS[theme]}
            iconSize={TAB_ICON_SIZE}
            label={t('appearance.label', { theme: t(`menu.themes.${theme}`) })}
            onClick={() => setTheme(nextTheme(theme))}
          />
          <IconButton
            icon="export"
            iconSize={TAB_ICON_SIZE}
            label={t('export.open')}
            title={canExport ? shortcuts.label(t('export.open'), 'export') : t('export.nothing')}
            disabled={!canExport}
            onClick={onExport}
          />
          <IconButton
            icon="save"
            iconSize={TAB_ICON_SIZE}
            label={t('keymap.save')}
            title={shortcuts.label(t('keymap.save'), 'save')}
            onClick={onSave}
          />
          <SaveStatus state={saveState} />
        </div>
      )}
    </header>
  )
}
