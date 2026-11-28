import { describe, expect, it } from 'vitest'
import {
  describeInputError,
  isSystemInput,
  loadHearSelf,
  loadLearnedLatency,
  monitorsItself,
  pickInputDevice,
  playsOutLoud,
  saveHearSelf,
  saveLearnedLatency,
  setupKey
} from './devices'

const device = (deviceId: string): MediaDeviceInfo => ({ deviceId }) as MediaDeviceInfo

describe('pickInputDevice', () => {
  const inputs = [device('default'), device('rode'), device('builtin')]

  it.each([
    ['the preferred mic when it is still connected', inputs, 'rode', 'rode'],
    ['the system default when the preferred mic is gone', inputs, 'unplugged', 'default'],
    ['the first mic when there is no default entry', inputs.slice(1), null, 'rode'],
    ['nothing when no mic is connected', [], 'rode', null]
  ])('picks %s', (_, connected, preferred, picked) => {
    expect(pickInputDevice(connected, preferred)).toBe(picked)
  })
})

describe('playsOutLoud', () => {
  const output = (deviceId: string, label: string): MediaDeviceInfo =>
    ({ deviceId, label, kind: 'audiooutput' }) as MediaDeviceInfo

  it.each([
    ['Default - MacBook Pro Speakers (Built-in)', true],
    ['Default - LG UltraFine Display Audio', true],
    ['Default - External Headphones (Built-in)', false],
    ['Default - AirPods Pro', false]
  ])('hears "%s" as out loud: %s', (label, loud) => {
    expect(playsOutLoud([output('default', label)])).toBe(loud)
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

describe('monitorsItself', () => {
  const dev = (kind: MediaDeviceKind, deviceId: string, groupId: string, label: string) =>
    ({ kind, deviceId, groupId, label }) as MediaDeviceInfo
  const rodeIn = dev('audioinput', 'rode', 'usb', 'RODE NT-USB (19f7:0003)')
  const builtinIn = dev('audioinput', 'mbp', 'mac', 'MacBook Pro Microphone (Built-in)')
  const inputs = [dev('audioinput', 'default', 'usb', 'Default - RODE NT-USB'), rodeIn, builtinIn]

  it('spots headphones plugged into the mic itself', () => {
    const outputs = [dev('audiooutput', 'default', 'usb', 'Default - RODE NT-USB (19f7:0003)')]
    expect(monitorsItself(inputs, 'rode', outputs)).toBe(true)
    expect(monitorsItself(inputs, 'default', outputs)).toBe(true)
  })

  it('matches the mic and output by name when the groups differ', () => {
    const outputs = [dev('audiooutput', 'default', 'other', 'Default - RODE NT-USB (19f7:0003)')]
    expect(monitorsItself(inputs, 'rode', outputs)).toBe(true)
  })

  it('leaves other headphones alone', () => {
    const outputs = [dev('audiooutput', 'default', 'bt', 'Default - AirPods Pro')]
    expect(monitorsItself(inputs, 'rode', outputs)).toBe(false)
  })

  it("doesn't count the Mac's own mic and headphone jack", () => {
    const outputs = [
      dev('audiooutput', 'default', 'mac', 'Default - External Headphones (Built-in)')
    ]
    expect(monitorsItself(inputs, 'mbp', outputs)).toBe(false)
  })
})

describe('hear yourself', () => {
  it('remembers the choice for each mic and output pair', () => {
    saveHearSelf('rode|Headphones', false)
    expect(loadHearSelf('rode|Headphones')).toBe(false)
    expect(loadHearSelf('rode|AirPods')).toBeNull()
  })
})
