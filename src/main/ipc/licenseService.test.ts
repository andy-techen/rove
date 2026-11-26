import { describe, expect, it } from 'vitest'
import { fakeLicenseService } from './licenseService'

describe('fakeLicenseService', () => {
  const service = fakeLicenseService({ delayMs: 0 })

  it('accepts any key that looks like one', async () => {
    expect(await service.activate('38b1460a-5104-4067-a91d-77b872934d51')).toEqual({ ok: true })
  })

  it('turns down something too short to be a key, to try the error message', async () => {
    expect(await service.activate('abc')).toEqual({ ok: false, reason: 'invalid' })
  })
})
