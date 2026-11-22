import { describe, expect, it } from 'vitest'
import { describeInputError, pickInputDevice } from './devices'

const device = (deviceId: string): MediaDeviceInfo => ({ deviceId }) as MediaDeviceInfo

describe('pickInputDevice', () => {
  const inputs = [device('default'), device('rode'), device('builtin')]

  it('keeps the preferred mic when it is still connected', () => {
    expect(pickInputDevice(inputs, 'rode')).toBe('rode')
  })

  it('falls back to the system default when the preferred mic is gone', () => {
    expect(pickInputDevice(inputs, 'unplugged')).toBe('default')
  })

  it('uses the first mic when there is no default entry', () => {
    expect(pickInputDevice([device('rode'), device('builtin')], null)).toBe('rode')
  })

  it('returns null when no mic is connected', () => {
    expect(pickInputDevice([], 'rode')).toBeNull()
  })
})

describe('describeInputError', () => {
  it('explains a busy or unplugged mic', () => {
    expect(describeInputError(new DOMException('', 'NotReadableError'))).toMatch(/busy/)
  })

  it('falls back to a generic message for unknown errors', () => {
    expect(describeInputError(new Error('boom'))).toBe("Couldn't open that microphone.")
  })
})
