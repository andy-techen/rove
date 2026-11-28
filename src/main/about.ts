import { app } from 'electron'
import { t } from '@shared/copy'

/**
 * Names the app Rove everywhere macOS shows it (the app menu's About, Hide and Quit) and
 * fills in the About panel. Run before the app is ready. A packaged app is already named
 * Rove by electron-builder; in development the menu bar still says Electron, because
 * that comes from the Electron binary itself.
 */
export function setUpAbout(icon: string): void {
  // Settings and remembered songs stay where they were saved under the old name.
  const userData = app.getPath('userData')
  app.setName(t('app.name'))
  app.setPath('userData', userData)
  app.setAboutPanelOptions({
    applicationName: t('app.name'),
    applicationVersion: app.getVersion(),
    // Empty, or macOS adds the build number in brackets, which is the same version again.
    version: '',
    // Third-party licences ship with the app's files and the README credits them, so
    // the panel keeps to who Rove is for.
    credits: t('app.tagline'),
    copyright: t('app.copyright', { year: new Date().getFullYear() }),
    // Windows and Linux; macOS shows the app's own icon.
    iconPath: icon
  })
}
