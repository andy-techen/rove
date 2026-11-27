import { describe, expect, it } from 'vitest'
import {
  describeInputError,
  isSystemInput,
  loadLearnedLatency,
  pickInputDevice,
  playsOutLoud,
  saveLearnedLatency,
  setupKey
} from './devices'

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

describe('playsOutLoud', () => {
  const output = (deviceId: string, label: string): MediaDeviceInfo =>
    ({ deviceId, label, kind: 'audiooutput' }) as MediaDeviceInfo

  it('spots the built-in speakers as the system output', () => {
    expect(playsOutLoud([output('default', 'Default - MacBook Pro Speakers (Built-in)')])).toBe(
      true
    )
  })

  it('spots a display playing the sound', () => {
    expect(playsOutLoud([output('default', 'Default - LG UltraFine Display Audio')])).toBe(true)
  })

  it('trusts headphones and earbuds', () => {
    expect(playsOutLoud([output('default', 'Default - External Headphones (Built-in)')])).toBe(
      false
    )
    expect(playsOutLoud([output('default', 'Default - AirPods Pro')])).toBe(false)
  })

  it('reads only the system output, not other connected devices', () => {
    const outputs = [
      output('default', 'Default - AirPods Pro'),
      output('mbp', 'MacBook Pro Speakers')
    ]
    expect(playsOutLoud(outputs)).toBe(false)
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

describe('learned latency', () => {
  const output = (label: string): MediaDeviceInfo =>
    ({ deviceId: 'default', label, kind: 'audiooutput' }) as MediaDeviceInfo

  it('remembers a delay for each mic and output pair', () => {
    const bluetooth = setupKey('default', [output('AirPods')])
    saveLearnedLatency(bluetooth, 0.14)
    expect(loadLearnedLatency(bluetooth)).toBe(0.14)
    expect(loadLearnedLatency(setupKey('default', [output('Headphones')]))).toBe(0)
  })
})

describe('isSystemInput', () => {
  const input = (deviceId: string, groupId: string): MediaDeviceInfo =>
    ({ deviceId, groupId, kind: 'audioinput' }) as MediaDeviceInfo
  const inputs = [input('default', 'mac'), input('builtin', 'mac'), input('rode', 'usb')]

  it('is the Mac’s current input, picked as Default or by name', () => {
    expect(isSystemInput(inputs, 'default')).toBe(true)
    expect(isSystemInput(inputs, 'builtin')).toBe(true)
  })

  it('isn’t another mic', () => {
    expect(isSystemInput(inputs, 'rode')).toBe(false)
  })
})
