import { app, clipboard, shell, BrowserWindow, ipcMain, session, systemPreferences } from 'electron'
import { join } from 'path'
import { electronApp, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { setUpAbout } from './about'
import { registerProjectIpc } from './ipc/project'
import { registerExportIpc } from './ipc/export'
import { registerLyricsIpc } from './ipc/lyrics'
import { registerAppearanceIpc, reportTheme } from './ipc/appearance'
import { registerKeymapIpc } from './ipc/keymap'
import { registerSettingsIpc } from './ipc/settings'
import { registerSeparationIpc } from './ipc/separation'
import { registerWishlistIpc } from './ipc/wishlist'
import { registerCatalogIpc } from './ipc/catalog'
import { APP_ORIGIN, registerAppScheme, serveApp } from './appProtocol'
import {
  CLIPBOARD_TEXT_CHANNEL,
  FULL_SCREEN_CHANNEL,
  NATIVE_EDIT_CHANNEL,
  NATIVE_EDITS
} from '@shared/menu'

// Opening size, and the smallest that still fits the timeline and mixer.
const WINDOW = { width: 900, height: 670, minWidth: 640, minHeight: 480 }

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    ...WINDOW,
    show: false,
    autoHideMenuBar: true,
    title: 'Rove',
    // On macOS the song tabs sit in the title bar, beside the window controls.
    ...(process.platform === 'darwin' ? { titleBarStyle: 'hiddenInset' as const } : {}),
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  const reportFullScreen = (): void =>
    mainWindow.webContents.send(FULL_SCREEN_CHANNEL, mainWindow.isFullScreen())
  mainWindow.on('enter-full-screen', reportFullScreen)
  mainWindow.on('leave-full-screen', reportFullScreen)
  mainWindow.webContents.on('did-finish-load', reportFullScreen)
  mainWindow.webContents.on('did-finish-load', () => reportTheme(mainWindow))

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadURL(`${APP_ORIGIN}/index.html`)
  }
}

registerAppScheme()
setUpAbout(icon)

async function requestMicAccess(): Promise<boolean> {
  if (process.platform !== 'darwin') return true
  if (systemPreferences.getMediaAccessStatus('microphone') === 'granted') return true
  // Resolves false without prompting if the user already denied access once;
  // only System Settings can re-enable it at that point.
  return systemPreferences.askForMediaAccess('microphone')
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.andytechen.rove')
  // In development the app runs inside Electron's own bundle; show Rove's icon in the Dock
  // and the About panel instead of Electron's.
  if (is.dev) app.dock?.setIcon(icon)
  serveApp(join(__dirname, '../renderer'))

  // Grant audio capture only; the app never needs camera or screen access.
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback, details) => {
    if (permission !== 'media') return callback(false)
    const mediaTypes = 'mediaTypes' in details ? (details.mediaTypes ?? []) : []
    callback(mediaTypes.length > 0 && mediaTypes.every((t) => t === 'audio'))
  })

  ipcMain.handle('mic:requestAccess', requestMicAccess)
  ipcMain.handle('mic:openSettings', () =>
    shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone')
  )
  // Text fields keep their own undo, cut, copy and paste (see the Edit menu).
  ipcMain.handle(NATIVE_EDIT_CHANNEL, (e, command: unknown) => {
    if ((NATIVE_EDITS as readonly unknown[]).includes(command)) {
      e.sender[command as (typeof NATIVE_EDITS)[number]]()
    }
  })
  // Read only, and only text: Paste on a chord chart reads a chord sheet from it.
  ipcMain.handle(CLIPBOARD_TEXT_CHANNEL, () => clipboard.readText())
  registerProjectIpc()
  registerExportIpc()
  registerLyricsIpc()
  await registerAppearanceIpc()
  await registerKeymapIpc()
  await registerSettingsIpc()
  registerSeparationIpc()
  registerWishlistIpc()
  registerCatalogIpc()

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
