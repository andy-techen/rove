import { CSSProperties, ReactNode, useLayoutEffect, useRef, useState } from 'react'
import { t } from '@shared/copy'
import { FONTS, FontId, FontScript, fontFamilyOf } from '../../audio/export/videoFonts'
import { Button } from '../ui/Button'
import { Tooltip } from '../ui/Tooltip'
import { BELOW_TOP, BELOW_TOP_WITH_FONTS, SHIFT_EPSILON_PX } from './constants'

const SCRIPTS: FontScript[] = ['latin', 'chinese']

interface Props {
  /** The top of the text the bar belongs to, as a share of the frame's height. */
  top: number
  /** Where the bar sits: the text's placement on the frame. */
  placement: CSSProperties
  font: FontId
  /** The fonts this machine has, to choose from. */
  fonts: FontId[]
  onFont(font: FontId): void
  /** Controls before and after the font in the bar's row. */
  before?: ReactNode
  after?: ReactNode
}

/**
 * The small bar beside chosen text on the picture: its controls in a row, with the font
 * as a button that opens every font to pick from.
 */
export function PictureBar({
  top,
  placement,
  font,
  fonts,
  onFont,
  before,
  after
}: Props): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const name = t(`export.video.fonts.${font}`)
  const bar = useRef<HTMLDivElement>(null)
  const [shift, setShift] = useState(0)
  // The bar is centred over its text, but it's often wider than narrow words: slide it
  // sideways just enough to stay inside the picture, which clips anything outside.
  useLayoutEffect(() => {
    const el = bar.current
    const frame = el?.offsetParent
    if (!el || !frame) return
    const box = el.getBoundingClientRect()
    const edges = frame.getBoundingClientRect()
    const left = box.left - shift
    const right = box.right - shift
    const wanted = Math.max(edges.left - left, Math.min(0, edges.right - right))
    if (Math.abs(wanted - shift) > SHIFT_EPSILON_PX) setShift(wanted)
    // `placement` is a new object each render, so this measures whenever the text may have
    // moved or changed size.
  }, [placement, open, shift])
  return (
    <div
      ref={bar}
      className="picture-words-bar"
      data-below={top < (open ? BELOW_TOP_WITH_FONTS : BELOW_TOP) ? '' : undefined}
      style={{ ...placement, '--bar-shift': `${shift}px` } as CSSProperties}
      onPointerDown={(e) => {
        e.stopPropagation()
        // Buttons here keep the keyboard in the words being typed, so a font or size can
        // be picked before typing. The colour well needs focus to open its picker.
        if (!(e.target as Element).closest('label')) e.preventDefault()
      }}
    >
      <div className="picture-words-tools">
        {before}
        <Tooltip text={t('export.video.fontTip')}>
          <Button
            variant="quiet"
            size="sm"
            className="picture-words-font"
            style={{ '--words-font': fontFamilyOf(font) } as CSSProperties}
            aria-label={t('export.video.font', { name })}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {name}
          </Button>
        </Tooltip>
        {after}
      </div>
      {open && (
        // A sample of each font in itself, so the singer sees them all at once. It stays
        // open while they try a few; the text on the picture changes with each.
        <div className="picture-words-fonts" role="group" aria-label={t('export.video.fontTip')}>
          {SCRIPTS.map((script) => {
            const ofScript = fonts.filter((id) => FONTS[id].script === script)
            if (!ofScript.length) return null
            return (
              <div key={script} className="picture-words-font-grid">
                {ofScript.map((id) => (
                  <Tooltip key={id} text={t(`export.video.fonts.${id}`)}>
                    <button
                      type="button"
                      className="picture-words-sample"
                      style={{ '--words-font': fontFamilyOf(id) } as CSSProperties}
                      aria-label={t(`export.video.fonts.${id}`)}
                      aria-pressed={font === id}
                      onClick={() => onFont(id)}
                    >
                      {t(`export.video.fontSamples.${script}`)}
                    </button>
                  </Tooltip>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
