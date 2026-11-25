import { Fragment, KeyboardEvent, useEffect, useState } from 'react'
import { t } from '@shared/copy'
import {
  KEYMAP,
  KeymapProblem,
  ShortcutGroup,
  SHORTCUT_IDS,
  ShortcutId,
  acceleratorFromEvent,
  checkAccelerator,
  isGesture,
  withBinding
} from '@shared/keymap'
import { saveOverrides, useKeymap } from '../../state/commands/keymap'
import { useShortcuts } from '../../state/commands/shortcuts'
import { IconButton } from '../ui/IconButton'
import { cx } from '../ui/cx'

// File and Edit on the left, Playback and View on the right: about even, in menu order.
const COLUMNS: ShortcutGroup[][] = [
  ['file', 'edit'],
  ['playback', 'view']
]

// Pressed on their own while choosing keys, these just mean "more keys are coming".
const MODIFIER_KEYS = ['Meta', 'Control', 'Shift', 'Alt']

/** Every shortcut, grouped, each one rebindable by clicking it and pressing new keys. */
export function KeymapTable(): React.JSX.Element {
  const { keymap, overrides } = useKeymap()
  const shortcuts = useShortcuts()
  const [editing, setEditing] = useState<ShortcutId | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  const capture = (id: ShortcutId | null): void => {
    setEditing(id)
    setProblem(null)
    // Lets menu keys (⌘S…) reach us instead of running their command.
    void window.api.captureShortcutKeys(id !== null)
  }
  useEffect(() => () => void window.api.captureShortcutKeys(false), [])

  const bind = (id: ShortcutId, accelerator: string | null): void => {
    void saveOverrides(withBinding(overrides, id, accelerator))
  }

  const describe = (issue: KeymapProblem, accelerator: string): string => {
    const keys = shortcuts.format(accelerator)
    if (issue.kind === 'taken') return t('keymap.taken', { keys, label: t(`keymap.${issue.by}`) })
    if (issue.kind === 'reserved') return t('keymap.reserved', { keys })
    if (issue.kind === 'typing') return t('keymap.typing', { keys })
    return t('keymap.invalid')
  }

  const onKeyDown = (id: ShortcutId, e: KeyboardEvent): void => {
    if (editing !== id) return
    e.preventDefault()
    if (e.key === 'Escape') return capture(null)
    if (MODIFIER_KEYS.includes(e.key)) return
    // On a problem, keep listening so the next try needs no extra click.
    const accelerator = acceleratorFromEvent(e.nativeEvent)
    if (!accelerator) return setProblem(t('keymap.invalid'))
    const issue = checkAccelerator(keymap, id, accelerator)
    if (issue) return setProblem(describe(issue, accelerator))
    capture(null)
    bind(id, accelerator)
  }

  const hasChanges = Object.keys(overrides).length > 0

  const renderColumn = (column: ShortcutGroup[]): React.JSX.Element => (
    <table className="keymap-table" key={column.join()}>
      <thead className="visually-hidden">
        <tr>
          <th scope="col">{t('keymap.action')}</th>
          <th scope="col">{t('keymap.keys')}</th>
        </tr>
      </thead>
      {column.map((group) => (
        <tbody key={group}>
          <tr>
            <th scope="colgroup" colSpan={2} className="keymap-group">
              {t(`keymap.groups.${group}`)}
            </th>
          </tr>
          {SHORTCUT_IDS.filter((id) => KEYMAP[id].group === group).map((id) => {
            const label = t(`keymap.${id}`)
            const changed = id in overrides
            return (
              <Fragment key={id}>
                <tr>
                  <th scope="row">{label}</th>
                  <td>
                    <div className="keymap-cell">
                      {changed && (
                        <IconButton
                          icon="reset"
                          label={t('keymap.reset', { label })}
                          onClick={() => bind(id, null)}
                        />
                      )}
                      {isGesture(id) ? (
                        <kbd className="keymap-keys">{shortcuts.keys(id)}</kbd>
                      ) : (
                        <button
                          type="button"
                          className={cx(
                            'keymap-keys',
                            changed && 'changed',
                            editing === id && 'capturing'
                          )}
                          aria-label={t('keymap.change', { label, keys: shortcuts.keys(id) })}
                          onClick={() => capture(editing === id ? null : id)}
                          onKeyDown={(e) => onKeyDown(id, e)}
                          onBlur={() => editing === id && capture(null)}
                        >
                          {editing === id ? t('keymap.pressKeys') : <kbd>{shortcuts.keys(id)}</kbd>}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {/* Said beside the row being changed, so it's seen without scrolling. */}
                {editing === id && problem && (
                  <tr>
                    <td colSpan={2} className="keymap-problem error" role="alert">
                      {problem}
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      ))}
    </table>
  )

  return (
    <div className="keymap">
      <header className="keymap-header">
        <p className="keymap-hint">{t('keymap.hint')}</p>
        <IconButton
          className="keymap-reset-all"
          icon="reset"
          label={t('keymap.resetAll')}
          disabled={!hasChanges}
          onClick={() => void saveOverrides({})}
        />
      </header>
      {/* Two columns side by side; the dialog's section scrolls when they're long. */}
      <div className="keymap-scroll">
        <div className="keymap-columns">{COLUMNS.map(renderColumn)}</div>
      </div>
    </div>
  )
}
