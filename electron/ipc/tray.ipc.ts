/**
 * tray.ipc.ts
 * System tray icon + context menu for Command-Center.
 *
 * Behaviour:
 *  - Tray icon appears in Windows system tray on app launch
 *  - Right-click → context menu: Show / Hide, separator, Quit
 *  - Double-click tray icon → show + focus window
 *  - Closing the main window hides it to tray (does NOT quit)
 *  - Quit via tray menu or app.quit() performs a clean exit
 *
 * Call registerTrayHandlers(mainWindow) after createWindow() in index.ts.
 * Call destroyTray() on app.beforeQuit to clean up the Tray instance.
 */

import { app, Tray, Menu, BrowserWindow, nativeImage } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { getDb } from '../db/database'
import { getSettings, updateSettings } from '../db/queries/settings.queries'
import { getStartupEnabled, setStartupEnabled } from '../services/startup.service'

let tray: Tray | null = null
let isQuitting = false

/**
 * Resolve the tray icon path for both dev and production.
 *
 * Dev:  __dirname = <project>/out/main/  (electron-vite output)
 *       icon is at <project>/public/icon.png
 *
 * Prod: app is packaged inside app.asar - public/ is NOT inside the asar.
 *       icon.png is placed in extraResources → available at process.resourcesPath/icon.png
 *
 * Strategy: try resourcesPath first (prod), fall back to project root (dev).
 */
function resolveTrayIconPath(): string {
  const prodPath = join(process.resourcesPath, 'icon.png')
  if (existsSync(prodPath)) return prodPath

  // Dev fallback - walk up from out/main/ to project root, then into public/
  const devPath = join(__dirname, '..', '..', 'public', 'icon.png')
  return devPath
}


/**
 * Build the tray context menu, binding actions to the given window.
 * Recreated every time it's needed so Show/Hide label is always current.
 */
function buildMenu(win: BrowserWindow): Menu {
  const visible = win.isVisible()
  // Read OS state directly - never read from DB for UI checkbox state
  const startupEnabled = getStartupEnabled()

  return Menu.buildFromTemplate([
    {
      label: visible ? 'Hide Command-Center' : 'Show Command-Center',
      click: () => {
        if (win.isVisible()) {
          win.hide()
        } else {
          win.show()
          win.focus()
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Launch at Startup',
      type: 'checkbox',
      checked: startupEnabled,
      click: () => {
        const newValue = !startupEnabled
        try {
          setStartupEnabled(newValue)
          updateSettings(getDb(), { launchOnStartup: newValue })
          // Notify renderer so the Settings page toggle stays in sync
          if (!win.isDestroyed()) {
            win.webContents.send('startup:changed', newValue)
          }
        } catch { /* non-fatal */ }
      },
    },
    { type: 'separator' },
    {
      label: 'Reload',
      click: () => { win.webContents.reload() },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true
        app.quit()
      },
    },
  ])
}


export function registerTrayHandlers(win: BrowserWindow): void {
  const iconPath = resolveTrayIconPath()
  const icon = nativeImage.createFromPath(iconPath)
  const trayIcon = icon.resize({ width: 16, height: 16 })

  tray = new Tray(trayIcon)
  tray.setToolTip('Command-Center')

  tray.on('right-click', () => {
    tray!.setContextMenu(buildMenu(win))
    tray!.popUpContextMenu()
  })

  tray.on('click', () => {
    if (win.isVisible()) {
      win.hide()
    } else {
      win.show()
      win.focus()
    }
  })

  tray.on('double-click', () => {
    win.show()
    win.focus()
  })

  win.on('close', (event) => {
    if (!isQuitting) {
      const shouldMinimize = (() => {
        try { return getSettings(getDb()).minimizeToTray } catch { return true }
      })()
      if (shouldMinimize) {
        event.preventDefault()
        win.hide()
      }
    }
  })

  app.on('before-quit', () => {
    isQuitting = true
  })
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy()
    tray = null
  }
}
