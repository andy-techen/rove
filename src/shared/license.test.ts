import { describe, expect, it } from 'vitest'
import { keyHint, parseLicenseStatus, parseStoredLicense } from './license'

describe('keyHint', () => {
  it('shows only the last few characters of a key', () => {
    expect(keyHint('38b1460a-5104-4067-a91d-77b872934d51')).toBe('•••• 4d51')
  })
})

describe('parseStoredLicense', () => {
  it('keeps a stored key', () => {
    expect(parseStoredLicense({ key: 'abc-123-def', activatedAt: 5 })).toEqual({
      key: 'abc-123-def',
      activatedAt: 5
    })
  })

  it('treats anything unreadable as no license', () => {
    expect(parseStoredLicense({ key: '' })).toBeNull()
    expect(parseStoredLicense(null)).toBeNull()
  })
})

describe('parseLicenseStatus', () => {
  it('falls back to free with no key', () => {
    expect(parseLicenseStatus({ plan: 'gold' })).toEqual({ plan: 'free', keyHint: null })
  })
})
