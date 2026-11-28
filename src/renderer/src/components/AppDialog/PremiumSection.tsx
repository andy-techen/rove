import { FormEvent, useState } from 'react'
import { t } from '@shared/copy'
import { PREMIUM_FEATURES } from '@shared/license/premiumFeatures'
import { ActivationFailure } from '@shared/license/license'
import { useLicense } from '../../state/license/useFeature'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { HelpTip } from '../ui/HelpTip'
import { Icon } from '../ui/Icon'
import { raised } from '../ui/Raised'

/** What premium unlocks, read from the one premium list so it never falls behind. */
function FeatureList(): React.JSX.Element {
  return (
    <ul className="premium-features">
      {PREMIUM_FEATURES.map((feature) => (
        <li key={feature}>
          <Icon name="check" size="secondary" />
          {t(`premium.features.${feature}`)}
        </li>
      ))}
    </ul>
  )
}

/** What Premium gives, on its own raised card, under a line that says where you stand. */
function PremiumCard({
  lead,
  children
}: {
  lead: string
  children?: React.ReactNode
}): React.JSX.Element {
  return (
    <div className={`premium-card ${raised}`}>
      <p className="premium-lead">
        <strong>{lead}</strong>
      </p>
      <FeatureList />
      {children}
    </div>
  )
}

/** On the free plan: buy premium, or activate a key bought already. */
function Upgrade(): React.JSX.Element {
  const [key, setKey] = useState('')
  const [activating, setActivating] = useState(false)
  const [failure, setFailure] = useState<ActivationFailure | null>(null)
  const [buySoon, setBuySoon] = useState(false)

  const activate = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    setActivating(true)
    setFailure(null)
    const result = await window.api.activateLicense(key.trim())
    setActivating(false)
    // On success the main process sends the new plan, and this screen gives way.
    if (!result.ok) setFailure(result.reason)
  }

  return (
    <>
      <PremiumCard lead={t('premium.pitch')}>
        <div className="premium-buy">
          <Button
            variant="primary"
            onClick={() => void window.api.openCheckout().then((opened) => setBuySoon(!opened))}
          >
            {t('premium.buy')}
          </Button>
          {buySoon && <p className="premium-note">{t('premium.buySoon')}</p>}
        </div>
      </PremiumCard>
      <form className="premium-key" onSubmit={(e) => void activate(e)}>
        <span className="premium-key-details">{t('premium.haveKey')}</span>
        <div className="premium-key-row">
          <input
            type="text"
            aria-label={t('premium.keyLabel')}
            placeholder={t('premium.keyPlaceholder')}
            value={key}
            spellCheck={false}
            autoComplete="off"
            onChange={(e) => setKey(e.target.value)}
          />
          <Button type="submit" variant="secondary" disabled={!key.trim() || activating}>
            {activating ? t('premium.activating') : t('premium.activate')}
          </Button>
          <Button variant="ghost" onClick={() => void window.api.openLicenseOrders()}>
            {t('premium.lostKey')}
          </Button>
        </div>
        {failure && (
          <p className="error" role="alert">
            {t(`premium.errors.${failure}`)}
          </p>
        )}
      </form>
    </>
  )
}

/** On premium: what's unlocked, the key, and freeing this Mac for another. */
function Unlocked({ keyHint }: { keyHint: string | null }): React.JSX.Element {
  const [freeing, setFreeing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const deactivate = async (): Promise<void> => {
    setConfirming(false)
    setFreeing(true)
    await window.api.deactivateLicense()
    setFreeing(false)
  }
  return (
    <>
      <PremiumCard lead={t('premium.on')} />
      <div className="premium-key">
        <div className="premium-key-row premium-key-details">
          <span>{t('premium.keyLabel')}</span>
          <span className="premium-hint">{keyHint}</span>
          <Button variant="quiet" size="sm" disabled={freeing} onClick={() => setConfirming(true)}>
            {freeing ? t('premium.deactivating') : t('premium.deactivate')}
          </Button>
          <HelpTip text={t('premium.deactivateHint')} />
        </div>
      </div>
      {confirming && (
        <ConfirmDialog
          title={t('premium.deactivateTitle')}
          message={t('premium.deactivateWarning')}
          confirmLabel={t('premium.deactivateConfirm')}
          sizeKey="deactivateLicense"
          onConfirm={() => void deactivate()}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  )
}

/** Rove Premium: a one-time purchase, unlocked on this Mac with a license key. */
export function PremiumSection(): React.JSX.Element {
  const { plan, keyHint } = useLicense()
  return (
    <div className="premium">
      {plan === 'premium' ? <Unlocked keyHint={keyHint} /> : <Upgrade />}
    </div>
  )
}
