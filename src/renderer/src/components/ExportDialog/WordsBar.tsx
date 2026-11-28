import { CSSProperties } from 'react'
import { t } from '@shared/copy'
import { stepSize } from '../../audio/export/videoLayout'
import { TextBox, WORDS_SIZES } from '../../audio/export/videoFrame'
import { FontId } from '../../audio/export/videoFonts'
import { IconButton } from '../ui/IconButton'
import { Tooltip } from '../ui/Tooltip'
import { AlignButton } from './AlignButton'
import { PictureBar } from './PictureBar'

interface Props {
  box: TextBox
  /** The top of the words, as a share of the frame's height. */
  top: number
  placement: CSSProperties
  /** The colour the words take when the singer hasn't picked one. */
  autoInk: string
  fonts: FontId[]
  onChange(change: Partial<TextBox>): void
  onRemove(): void
}

/** Colour, font, lining up, size and remove for the chosen words, just beside them. */
export function WordsBar({
  box,
  top,
  placement,
  autoInk,
  fonts,
  onChange,
  onRemove
}: Props): React.JSX.Element {
  const colour = box.colour ?? autoInk
  return (
    <PictureBar
      top={top}
      placement={placement}
      font={box.font}
      fonts={fonts}
      onFont={(font) => onChange({ font })}
      before={
        <Tooltip text={t('export.video.wordsColour')}>
          <label
            className="picture-swatch picture-swatch-colour"
            style={{ '--swatch-colour': colour } as CSSProperties}
          >
            <input
              type="color"
              className="visually-hidden"
              aria-label={t('export.video.wordsColour')}
              value={colour}
              onInput={(e) => onChange({ colour: e.currentTarget.value })}
              onChange={(e) => onChange({ colour: e.target.value })}
            />
          </label>
        </Tooltip>
      }
      after={
        <>
          <AlignButton align={box.align} onAlign={(align) => onChange({ align })} />
          <IconButton
            icon="textSmaller"
            iconSize="secondary"
            label={t('export.video.smaller')}
            disabled={box.size <= WORDS_SIZES[0]}
            onClick={() => onChange({ size: stepSize(box.size, WORDS_SIZES, -1) })}
          />
          <IconButton
            icon="textLarger"
            iconSize="secondary"
            label={t('export.video.larger')}
            disabled={box.size >= WORDS_SIZES[WORDS_SIZES.length - 1]}
            onClick={() => onChange({ size: stepSize(box.size, WORDS_SIZES, 1) })}
          />
          <IconButton
            icon="delete"
            iconSize="secondary"
            label={t('export.video.removeWords')}
            onClick={onRemove}
          />
        </>
      }
    />
  )
}
