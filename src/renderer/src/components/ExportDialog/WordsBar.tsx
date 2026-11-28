import { CSSProperties } from 'react'
import { t } from '@shared/copy'
import { stepSize } from '../../audio/export/videoLayout'
import { TextBox, WORDS_SIZES } from '../../audio/export/videoFrame'
import { FontId } from '../../audio/export/videoFonts'
import { IconButton } from '../ui/IconButton'
import { AlignButton } from './AlignButton'
import { InkSwatch } from './InkSwatch'
import { PictureBar } from './PictureBar'

interface Props {
  box: TextBox
  /** The top of the words, as a share of the frame's height. */
  top: number
  placement: CSSProperties
  /** The colour the words take when the singer hasn't picked one. */
  autoInk: string
  fonts: FontId[]
  /** `key` groups a run of changes (sliding through colours) into one undo step. */
  onChange(change: Partial<TextBox>, key?: string): void
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
  return (
    <PictureBar
      top={top}
      placement={placement}
      font={box.font}
      fonts={fonts}
      onFont={(font) => onChange({ font })}
      before={
        <InkSwatch
          colour={box.colour ?? autoInk}
          label={t('export.video.wordsColour')}
          onColour={(colour) => onChange({ colour }, 'colour')}
        />
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
