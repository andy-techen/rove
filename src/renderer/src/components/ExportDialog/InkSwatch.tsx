import { CSSProperties, useEffect, useRef } from 'react'
import { t } from '@shared/copy'
import { useRecentColours } from '../../state/ui/recentColours'
import { Tooltip } from '../ui/Tooltip'

interface Props {
  /** The colour text is drawn in now: the one picked, or whichever reads on the picture. */
  colour: string
  label: string
  onColour(colour: string): void
}

/**
 * A swatch of the text's colour that opens the colour picker, with the last few colours
 * picked beside it, so a colour used on one set of words is a click away for the next.
 */
export function InkSwatch({ colour, label, onColour }: Props): React.JSX.Element {
  const [recent, remember] = useRecentColours(colour)
  const input = useRef<HTMLInputElement>(null)
  // The native change event comes once the picker settles; input events come on every
  // step of the drag, and only the colour chosen in the end is worth remembering.
  useEffect(() => {
    const el = input.current
    if (!el) return
    const onSettled = (): void => remember(el.value)
    el.addEventListener('change', onSettled)
    return () => el.removeEventListener('change', onSettled)
  }, [remember])

  return (
    <>
      <Tooltip text={label}>
        <label
          className="picture-swatch picture-swatch-colour"
          style={{ '--swatch-colour': colour } as CSSProperties}
        >
          <input
            ref={input}
            type="color"
            className="visually-hidden"
            aria-label={label}
            value={colour}
            // Input as the picker moves, so the picture follows; change when it closes.
            onInput={(e) => onColour(e.currentTarget.value)}
            onChange={(e) => onColour(e.target.value)}
          />
        </label>
      </Tooltip>
      {recent.map((c) => (
        <Tooltip key={c} text={t('export.video.recentColour', { colour: c })}>
          <button
            type="button"
            className="picture-recent-colour"
            style={{ '--swatch-colour': c } as CSSProperties}
            aria-label={t('export.video.recentColour', { colour: c })}
            onClick={() => {
              onColour(c)
              remember(c)
            }}
          />
        </Tooltip>
      ))}
    </>
  )
}
