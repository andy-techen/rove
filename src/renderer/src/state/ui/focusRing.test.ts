import { afterEach, describe, expect, it } from 'vitest'
import { keyboardFocus, trackFocusRing } from './focusRing'

const how = () => document.documentElement.dataset.input
const press = (key: string) => window.dispatchEvent(new KeyboardEvent('keydown', { key }))
let stop = (): void => {}
afterEach(() => stop())

describe('trackFocusRing', () => {
  it('hides the focus ring after a click', () => {
    stop = trackFocusRing()
    window.dispatchEvent(new Event('pointerdown'))
    expect(how()).toBe('pointer')
  })

  it('keeps it hidden while playing keys or using shortcuts', () => {
    stop = trackFocusRing()
    window.dispatchEvent(new Event('pointerdown'))
    press('a')
    press(' ')
    expect(how()).toBe('pointer')
  })

  it('shows it again when moving around with the keyboard', () => {
    stop = trackFocusRing()
    window.dispatchEvent(new Event('pointerdown'))
    press('Tab')
    expect(how()).toBe('keyboard')
  })
})

describe('keyboardFocus', () => {
  it('doesn’t count a clicked button as reached with the keyboard after a key press', () => {
    stop = trackFocusRing()
    const button = document.body.appendChild(document.createElement('button'))
    button.matches = () => true // jsdom has no :focus-visible; Chromium sets it on any key
    window.dispatchEvent(new Event('pointerdown'))
    press('a')
    expect(keyboardFocus(button)).toBe(false)
    press('Tab')
    expect(keyboardFocus(button)).toBe(true)
  })
})
