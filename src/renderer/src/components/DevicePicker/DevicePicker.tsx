import { t } from '@shared/copy'
import './DevicePicker.css'

interface Props {
  devices: MediaDeviceInfo[]
  deviceId: string | null
  onChange(deviceId: string): void
}

export function DevicePicker({ devices, deviceId, onChange }: Props): React.JSX.Element {
  return (
    <label className="device-picker">
      <span className="device-picker-label">{t('micCheck.microphone')}</span>
      <select value={deviceId ?? ''} onChange={(e) => onChange(e.target.value)}>
        {devices.map((d, i) => (
          <option key={d.deviceId} value={d.deviceId}>
            {d.label || t('micCheck.microphoneNumbered', { number: i + 1 })}
          </option>
        ))}
      </select>
    </label>
  )
}
