import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { t } from '@shared/copy'
import { defaultPolish } from '../../audio/polish/polish'
import { PolishPanel } from '.'

const onHide = vi.fn()

function renderPanel(polish = defaultPolish('lead'), canTune = true) {
  const onChange = vi.fn()
  render(
    <PolishPanel
      trackName="Vocal 1"
      part="lead"
      polish={polish}
      locked={false}
      canTune={canTune}
      onChange={onChange}
      onHide={onHide}
    />
  )
  return onChange
}

async function tooltipOf(control: HTMLElement) {
  act(() => control.focus())
  return screen.findByRole('tooltip')
}

const slider = (name: string): HTMLElement => screen.getByRole('slider', { name })

describe('PolishPanel', () => {
  it('hides itself from the button in its header', async () => {
    renderPanel()
    await userEvent.click(screen.getByRole('button', { name: t('panel.hide') }))
    expect(onHide).toHaveBeenCalled()
  })

  it('turns a plain-language slider into a setting, grouped as one undo step', () => {
    const onChange = renderPanel()
    fireEvent.change(slider(t('polish.controls.space.label')), { target: { value: '80' } })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ space: 0.8 }), 'polish:space')
  })

  it('resets every control to our suggested settings', async () => {
    const onChange = renderPanel({ ...defaultPolish('lead'), clarity: 1, space: 0 })
    await userEvent.click(screen.getByRole('button', { name: t('polish.reset') }))
    expect(onChange).toHaveBeenCalledWith(defaultPolish('lead'))
  })

  it('lets Advanced override one real parameter, and follow the slider again', async () => {
    const onChange = renderPanel({ ...defaultPolish('lead'), advanced: { compRatio: 6 } })
    await userEvent.click(screen.getByRole('button', { name: t('polish.advanced') }))
    expect(
      screen.getByRole('textbox', {
        name: t('polish.typeValue', { name: t('polish.params.compRatio') })
      })
    ).toHaveValue('6.0')
    await userEvent.click(screen.getByRole('button', { name: t('polish.followSlider') }))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ advanced: {} }))
  })

  it('takes a typed value in Advanced, kept inside the safe range', async () => {
    const onChange = renderPanel()
    await userEvent.click(screen.getByRole('button', { name: t('polish.advanced') }))
    const ratio = screen.getByRole('textbox', {
      name: t('polish.typeValue', { name: t('polish.params.compRatio') })
    })
    await userEvent.type(ratio, '4{Enter}')
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ advanced: { compRatio: 4 } })
    )
    await userEvent.type(ratio, '99{Enter}')
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ advanced: { compRatio: 8 } })
    )
  })

  it('explains each Advanced setting behind a help tip', async () => {
    renderPanel()
    await userEvent.click(screen.getByRole('button', { name: t('polish.advanced') }))
    const help = screen.getByRole('button', { name: t('polish.paramHints.compRatio') })
    expect(await tooltipOf(help)).toHaveTextContent(t('polish.paramHints.compRatio'))
  })

  it('ignores a typed value that is not a number', async () => {
    const onChange = renderPanel()
    await userEvent.click(screen.getByRole('button', { name: t('polish.advanced') }))
    const mix = screen.getByRole('textbox', {
      name: t('polish.typeValue', { name: t('polish.params.reverbMix') })
    })
    await userEvent.type(mix, 'lots{Enter}')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('switches polish off to compare with the original', async () => {
    const onChange = renderPanel()
    await userEvent.click(screen.getByRole('switch', { name: t('polish.switchLabel') }))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }))
  })

  it('says what the switch will do from where it is', async () => {
    renderPanel({ ...defaultPolish('lead'), enabled: false })
    const toggle = screen.getByRole('switch', { name: t('polish.switchLabel') })
    expect(await tooltipOf(toggle)).toHaveTextContent(t('polish.turnOnTitle'))
  })

  it('puts one control back to its suggested value', async () => {
    const onChange = renderPanel({ ...defaultPolish('lead'), clarity: 0.9, space: 0.1 })
    const name = t('polish.controls.clarity.label')
    await userEvent.click(screen.getByRole('button', { name: t('polish.resetControl', { name }) }))
    expect(onChange).toHaveBeenCalledWith({ ...defaultPolish('lead'), space: 0.1 })
  })

  it('offers no reset for a control already at its suggested value', () => {
    renderPanel()
    const name = t('polish.controls.clarity.label')
    expect(screen.queryByRole('button', { name: t('polish.resetControl', { name }) })).toBeNull()
  })

  it('takes a typed amount under a knob, kept between 0 and 100', async () => {
    const onChange = renderPanel()
    const name = t('polish.controls.space.label')
    const field = screen.getByRole('textbox', { name: t('panel.typeValue', { name }) })
    await userEvent.type(field, '150{Enter}')
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ space: 1 }))
  })

  it('leaves out tuning, with its Advanced settings, on the free plan', async () => {
    renderPanel(defaultPolish('lead'), false)
    await userEvent.click(screen.getByRole('button', { name: t('polish.advanced') }))
    expect(screen.queryByRole('slider', { name: t('polish.controls.tuning.label') })).toBeNull()
    expect(screen.queryByRole('slider', { name: t('polish.params.tuneStrength') })).toBeNull()
    expect(screen.queryByRole('slider', { name: t('polish.params.retuneMs') })).toBeNull()
    expect(slider(t('polish.controls.space.label'))).toBeInTheDocument()
  })
})
