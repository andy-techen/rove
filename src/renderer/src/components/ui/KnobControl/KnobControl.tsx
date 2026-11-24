import { ReactNode } from 'react'
import { t } from '@shared/copy'
import { cx } from '../cx'
import { HelpTip } from '../HelpTip'
import { IconButton } from '../IconButton'
import { Knob, KnobProps } from '../Knob'
import { NumberField } from '../NumberField'
import './KnobControl.css'

interface Props {
  /** The control's name, shown under the knob and read as its accessible name. */
  label: string
  /** What it does, behind a "?". */
  hint: string
  /** The setting under the name, as a number to type over ("50", "%"). */
  value: { number: string; unit?: string }
  /** What was typed into the value; the owner reads it and keeps it in range. */
  onType(text: string): void
  /** Accessible name of the value field; by default "<name>, typed value". */
  typeLabel?: string
  /** A control before the value, such as an on/off switch. */
  extra?: ReactNode
  /**
   * What to read first, before the value: the result rather than the change (the key
   * you'll sing in, "B♭ major"). The typed value then sits after it, quieter.
   */
  lead?: string
  /** Leaves out the typed value, e.g. when it's 0 and the lead says it all. */
  hideValue?: boolean
  /** Shows a ↶ beside the value that puts the control back, when given. */
  reset?: { label: string; onReset(): void } | null
  disabled?: boolean
  knob: Omit<KnobProps, 'label' | 'size' | 'disabled'>
}

/** A labelled knob as the panels show it: knob, name with help, value. */
export function KnobControl({
  label,
  hint,
  value,
  onType,
  typeLabel,
  extra,
  lead,
  hideValue,
  reset,
  disabled,
  knob
}: Props): React.JSX.Element {
  return (
    <div className="knob-control">
      <Knob {...knob} size="md" label={label} disabled={disabled} />
      <span className="knob-control-label">
        {label}
        <HelpTip text={hint} />
      </span>
      <span className="knob-control-value">
        {extra}
        {lead && <span className="knob-control-lead">{lead}</span>}
        {!hideValue && (
          <NumberField
            align="start"
            label={typeLabel ?? t('panel.typeValue', { name: label })}
            value={value.number}
            unit={value.unit}
            disabled={disabled}
            onCommit={onType}
          />
        )}
        {reset && (
          <IconButton
            icon="reset"
            iconSize="secondary"
            className="knob-control-reset"
            label={reset.label}
            disabled={disabled}
            onClick={reset.onReset}
          />
        )}
      </span>
    </div>
  )
}

/** Knob controls side by side, wrapping onto more rows in a narrow window. */
export function KnobRow({
  dimmed,
  children
}: {
  /** Drawn faded, e.g. while Polish is switched off to compare. */
  dimmed?: boolean
  children: ReactNode
}): React.JSX.Element {
  return <div className={cx('knob-row', dimmed && 'knob-row-dimmed')}>{children}</div>
}
