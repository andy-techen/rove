import { app, shell, BrowserWindow, ipcMain, session, systemPreferences } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    minWidth: 640,
    minHeight: 480,
    show: false,
    autoHideMenuBar: true,
    title: 'Rove',
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

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

async function requestMicAccess(): Promise<boolean> {
  if (process.platform !== 'darwin') return true
  if (systemPreferences.getMediaAccessStatus('microphone') === 'granted') return true
  // Resolves false without prompting if the user already denied access once;
  // only System Settings can re-enable it at that point.
  return systemPreferences.askForMediaAccess('microphone')
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.andytechen.rove')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

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
