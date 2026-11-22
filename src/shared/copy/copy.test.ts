import { describe, expect, it } from 'vitest'
import { t } from '.'

describe('copy', () => {
  it('looks up nested text and fills placeholders', () => {
    expect(t('shortcut', { label: 'Undo', keys: '⌘Z' })).toBe('Undo (⌘Z)')
    expect(t('polish.controls.space.label')).toBe('Space')
  })

  it('leaves unknown placeholders visible rather than dropping text', () => {
    expect(t('shortcut')).toBe('{label} ({keys})')
  })
})
