import { Plan, isEnabled } from '@shared/license/features'
import type { VocalsState } from '../processing/useVocalRemoval'

/**
 * Whether the Music panel shows the vocals control. Removing vocals is premium, but
 * putting back vocals removed earlier only undoes it, so that stays on every plan.
 */
export function offersVocals(plan: Plan, vocals: VocalsState): boolean {
  return isEnabled('vocalRemoval', plan) || vocals.state === 'removed'
}
