import { CSSProperties } from 'react'
import { t } from '@shared/copy'
import { stepSize } from '../../audio/export/videoLayout'
import { LYRICS_SIZES, LyricsStyle, lyricsEdge } from '../../audio/export/videoFrame'
import { FontId } from '../../audio/export/videoFonts'
import { IconButton } from '../ui/IconButton'
import { AlignButton } from './AlignButton'
import { InkSwatch } from './InkSwatch'
import { PictureBar } from './PictureBar'

interface Props {
  style: LyricsStyle
  /** The top of the lyrics, as a share of the frame's height. */
  top: number
  placement: CSSProperties
  /** The colour the lyrics take when the singer hasn't picked one. */
  autoInk: string
  fonts: FontId[]
  /** `key` groups a run of changes (sliding through colours) into one undo step. */
  onChange(change: Partial<LyricsStyle>, key?: string): void
}

/** Colour, font, lining up and size for the lyrics, just above them. */
export function LyricsBar({
  style,
  top,
  placement,
  autoInk,
  fonts,
  onChange
}: Props): React.JSX.Element {
  return (
    <PictureBar
      top={top}
      placement={placement}
      font={style.font}
      fonts={fonts}
      onFont={(font) => onChange({ font })}
      before={
        <InkSwatch
          colour={style.colour ?? autoInk}
          label={t('export.video.lyricsColour')}
          onColour={(colour) => onChange({ colour }, 'colour')}
        />
      }
      after={
        <>
          <AlignButton
            align={style.align}
            // Lined up a new way, the lyrics go to that margin (or the middle), where that
            // alignment reads best; they can be dragged on from there.
            onAlign={(align) =>
              onChange({ align, position: { ...style.position, x: lyricsEdge(align) } })
            }
          />
          <IconButton
            icon="textSmaller"
            iconSize="secondary"
            label={t('export.video.lyricsSmaller')}
            disabled={style.size <= LYRICS_SIZES[0]}
            onClick={() => onChange({ size: stepSize(style.size, LYRICS_SIZES, -1) })}
          />
          <IconButton
            icon="textLarger"
            iconSize="secondary"
            label={t('export.video.lyricsLarger')}
            disabled={style.size >= LYRICS_SIZES[LYRICS_SIZES.length - 1]}
            onClick={() => onChange({ size: stepSize(style.size, LYRICS_SIZES, 1) })}
          />
        </>
      }
    />
  )
}
