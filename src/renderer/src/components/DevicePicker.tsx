interface Props {
  devices: MediaDeviceInfo[]
  deviceId: string | null
  onChange(deviceId: string): void
}

export function DevicePicker({ devices, deviceId, onChange }: Props): React.JSX.Element {
  return (
    <label className="field">
      <span className="field-label">Microphone</span>
      <select value={deviceId ?? ''} onChange={(e) => onChange(e.target.value)}>
        {devices.map((d, i) => (
          <option key={d.deviceId} value={d.deviceId}>
            {d.label || `Microphone ${i + 1}`}
          </option>
        ))}
      </select>
    </label>
  )
}
