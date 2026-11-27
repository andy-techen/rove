import { t } from '@shared/copy'
import type { TakeOffer } from '../../state/transport/useTransport'
import { Button } from '../ui/Button'
import { IconButton } from '../ui/IconButton'
import type { IconName } from '../ui/Icon'
import { Tooltip } from '../ui/Tooltip'

interface Props {
  offer: TakeOffer
  onApply(): void
  onDismiss(): void
}

function copyOf(offer: TakeOffer): { label: string; icon: IconName; title: string } {
  if (offer.kind === 'syncHarmony') {
    return {
      label: t('transport.harmonySync.apply'),
      icon: 'syncHarmony',
      title: t(
        !offer.phrases
          ? 'transport.harmonySync.volume'
          : offer.volume === null
            ? 'transport.harmonySync.timing'
            : 'transport.harmonySync.both'
      )
    }
  }
  return {
    label: t('transport.lineUp.apply'),
    icon: 'lineUp',
    title: offer.bySec > 0 ? t('transport.lineUp.late') : t('transport.lineUp.early')
  }
}

/**
 * Offers to fix a just-recorded take's timing (line up, sync harmony) at the top left of
 * its lane, where it stays whole and in view however short the clip is.
 */
export function TakeOfferBar({ offer, onApply, onDismiss }: Props): React.JSX.Element {
  const { label, icon, title } = copyOf(offer)
  return (
    <span
      className="take-offer"
      // Pressing the offer isn't a click on the lane (a seek) or the start of a box.
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <Tooltip text={title}>
        <Button variant="quiet" size="sm" icon={icon} onClick={onApply}>
          {label}
        </Button>
      </Tooltip>
      <IconButton
        icon="close"
        iconSize="secondary"
        label={t('transport.keepTake')}
        onClick={onDismiss}
      />
    </span>
  )
}
