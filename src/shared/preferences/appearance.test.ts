import { describe, expect, it } from 'vitest'
import { nextTheme, parseTheme } from './appearance'

describe('parseTheme', () => {
  it('keeps a known theme and follows the system for anything else', () => {
    expect(parseTheme('light')).toBe('light')
    expect(parseTheme('purple')).toBe('system')
    expect(parseTheme(undefined)).toBe('system')
  })
})

describe('nextTheme', () => {
  it('goes system, light, dark and round again', () => {
    expect(nextTheme('system')).toBe('light')
    expect(nextTheme('light')).toBe('dark')
    expect(nextTheme('dark')).toBe('system')
  })
})
