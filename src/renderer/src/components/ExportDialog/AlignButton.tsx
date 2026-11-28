import { t } from '@shared/copy'
import { Align, nextAlign } from '../../audio/export/videoLayout'
import { IconButton } from '../ui/IconButton'

const ICONS = { left: 'alignLeft', center: 'alignCenter', right: 'alignRight' } as const

/** Steps the lines through left, centre and right, showing the one they're on. */
export function AlignButton({
  align,
  onAlign
}: {
  align: Align
  onAlign(align: Align): void
}): React.JSX.Element {
  return (
    <IconButton
      icon={ICONS[align]}
      iconSize="secondary"
      label={t('export.video.align', { side: t(`export.video.aligns.${align}`) })}
      onClick={() => onAlign(nextAlign(align))}
    />
  )
}
