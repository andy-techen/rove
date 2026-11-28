import { BrowserWindow, ipcMain, shell } from 'electron'
import { FeatureId, Plan, requireFeature } from '@shared/features'
import {
  ActivationResult,
  FREE_STATUS,
  LICENSE_CHANNELS,
  LicenseStatus,
  StoredLicense,
  keyHint,
  parseStoredLicense
} from '@shared/license'
import { fakeLicenseService } from './licenseService'
import { jsonStore } from './jsonStore'

// Lemon Squeezy's page where buyers find their orders and keys again.
const ORDERS_URL = 'https://app.lemonsqueezy.com/my-orders'
// Keys are typed or pasted; anything longer than this isn't one.
const MAX_KEY_LENGTH = 200

const service = fakeLicenseService()
// With no license saved, or one we can't read, this Mac is on free.
const store = jsonStore<StoredLicense | null>('license.json', parseStoredLicense, null)

let stored: StoredLicense | null = null

const status = (): LicenseStatus =>
  stored ? { plan: 'premium', keyHint: keyHint(stored.key) } : FREE_STATUS

export const currentPlan = (): Plan => status().plan

/** Stops IPC work on a feature this Mac's plan doesn't include. */
export const requirePlanFor = (feature: FeatureId): void => requireFeature(feature, currentPlan())

/** Tells a window the plan and key hint, so it shows or locks features to match. */
export const reportLicense = (win: BrowserWindow): void =>
  win.webContents.send(LICENSE_CHANNELS.changed, status())

async function keep(next: StoredLicense | null): Promise<void> {
  stored = next
  for (const win of BrowserWindow.getAllWindows()) reportLicense(win)
  await store.save(next)
}

async function activate(raw: unknown): Promise<ActivationResult> {
  const key = typeof raw === 'string' ? raw.trim() : ''
  if (!key || key.length > MAX_KEY_LENGTH) return { ok: false, reason: 'invalid' }
  const result = await service.activate(key)
  if (!result.ok) return result
  await keep({ key, activatedAt: Date.now() })
  return { ok: true, status: status() }
}

async function deactivate(): Promise<LicenseStatus> {
  if (stored) await service.deactivate(stored.key)
  await keep(null)
  return status()
}

/** Reads the saved license before the first window opens, and serves the license screens. */
export async function registerLicenseIpc(): Promise<void> {
  stored = await store.load()
  ipcMain.handle(LICENSE_CHANNELS.activate, (_e, key: unknown) => activate(key))
  ipcMain.handle(LICENSE_CHANNELS.deactivate, () => deactivate())
  // Only fixed addresses open in the browser; the window can't name one.
  ipcMain.handle(LICENSE_CHANNELS.openCheckout, async () => {
    if (!service.checkoutUrl) return false
    await shell.openExternal(service.checkoutUrl)
    return true
  })
  ipcMain.handle(LICENSE_CHANNELS.openOrders, () => shell.openExternal(ORDERS_URL))
}
