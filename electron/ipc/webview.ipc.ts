import { BrowserView, BrowserWindow, ipcMain, shell } from 'electron'
import { sanitizeUrl } from '../utils/sanitize'
import { getDb } from '../db/database'
import { getSettings } from '../db/queries/settings.queries'

const TOPBAR_H        = 48    // TopBar h-12
const PANEL_HEADER_H  = 40    // WebviewPanel header h-10
const PANEL_MIN_W     = 300
const PANEL_DEFAULT_W = 480
const PANEL_MIN_H     = 200   // minimum bottom-mode panel height
const PANEL_DEFAULT_H = 320   // default bottom-mode panel height
const PANEL_OFFSET_Y  = TOPBAR_H + PANEL_HEADER_H  // right-mode: BrowserView starts at y=88
const DRAG_HANDLE_W   = 8     // keep drag handle uncovered by BrowserView (right mode)
const SIDEBAR_W       = 224   // matches Sidebar fixed width

let mainWin:    BrowserWindow | null = null
let view:       BrowserView   | null = null
let panelW      = PANEL_DEFAULT_W
let panelH      = PANEL_DEFAULT_H
let resizeBound = false

// Named listener functions — kept at module scope so they can be removed
// from view.webContents in closeWebview(). Anonymous lambdas registered with
// .on() cannot be removed with .off(), which would leave dangling listeners
// on the old webContents if openWebview() is called again after a close.
function onDidNavigate(_e: Electron.Event, navUrl: string) {
  mainWin?.webContents.send('webview:urlChanged', { url: navUrl })
}
function onDidNavigateInPage(_e: Electron.Event, navUrl: string, isMainFrame: boolean) {
  if (isMainFrame) mainWin?.webContents.send('webview:urlChanged', { url: navUrl })
}

/** Reads current webview position setting from DB. Falls back to 'right' on error. */
function getPosition(): 'right' | 'bottom' {
  try { return getSettings(getDb()).webviewPosition } catch { return 'right' }
}

/** Computes BrowserView bounds for whichever position mode is active. */
function computeBounds(): { x: number; y: number; width: number; height: number } {
  const [cw, ch] = mainWin!.getContentSize()
  if (getPosition() === 'bottom') {
    // Bottom mode: BrowserView spans full content width (minus sidebar) below main area.
    // DRAG_HANDLE_W offset keeps the top drag strip uncovered.
    return {
      x:      SIDEBAR_W,
      y:      ch - panelH + DRAG_HANDLE_W,
      width:  Math.max(0, cw - SIDEBAR_W),
      height: Math.max(0, panelH - DRAG_HANDLE_W),
    }
  }
  // Right mode: BrowserView docked to right side.
  // DRAG_HANDLE_W offset keeps left drag strip uncovered by the BrowserView.
  return {
    x:      cw - panelW + DRAG_HANDLE_W,
    y:      PANEL_OFFSET_Y,
    width:  Math.max(0, panelW - DRAG_HANDLE_W),
    height: Math.max(0, ch - PANEL_OFFSET_Y),
  }
}

/** Repositions BrowserView when window resizes. */
function updateBounds(): void {
  if (view && mainWin) view.setBounds(computeBounds())
}

function attachResizeListener(): void {
  if (resizeBound || !mainWin) return
  mainWin.on('resize', updateBounds)
  resizeBound = true
}

function detachResizeListener(): void {
  if (!resizeBound || !mainWin) return
  mainWin.off('resize', updateBounds)
  resizeBound = false
}

/** Returns the main BrowserWindow reference, or null if not yet initialized. */
export function getMainWindow(): BrowserWindow | null { return mainWin }

/**
 * Opens or reuses BrowserView with the given URL.
 * Called directly from items.ipc.ts for URL-type launches.
 * Returns false if mainWin is not yet initialized (launch falls back to shell.openExternal).
 */
export function openWebview(url: string): boolean {
  if (!mainWin) return false  // registerWebviewHandlers not yet called

  if (!view) {
    view = new BrowserView({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    })
    mainWin.addBrowserView(view)
    attachResizeListener()

    // Forward navigation events to renderer so URL bar stays in sync.
    // Use named functions so they can be removed in closeWebview().
    view.webContents.on('did-navigate',         onDidNavigate)
    view.webContents.on('did-navigate-in-page', onDidNavigateInPage)
  }

  view.setBounds(computeBounds())
  view.webContents.loadURL(url).catch(() => { /* silently ignore load errors */ })

  // Push open + initial URL + position to renderer so useWebview state updates
  mainWin.webContents.send('webview:opened', { position: getPosition() })
  mainWin.webContents.send('webview:urlChanged', { url })
  return true
}

function closeWebview(): void {
  if (!view || !mainWin) return
  // Remove named listeners before dereferencing so the old webContents
  // doesn't hold a live reference that fires after the view is gone.
  view.webContents.removeListener('did-navigate',         onDidNavigate)
  view.webContents.removeListener('did-navigate-in-page', onDidNavigateInPage)
  mainWin.removeBrowserView(view)
  view = null  // GC handles cleanup; no explicit destroy needed for BrowserView
  detachResizeListener()
  mainWin.webContents.send('webview:closed')
}

/** Call after createWindow() — needs mainWindow reference. */
export function registerWebviewHandlers(win: BrowserWindow): void {
  mainWin = win

  // Clean up if window is destroyed (app quit)
  win.on('closed', () => {
    view    = null
    mainWin = null
    resizeBound = false
  })

  ipcMain.handle('webview:open', (_e, input) => {
    const url = sanitizeUrl(input?.url) || (input?.url as string) || ''
    if (url) openWebview(url)
  })

  ipcMain.handle('webview:navigate', (_e, input) => {
    const url = sanitizeUrl(input?.url) || (input?.url as string) || ''
    if (url && view) view.webContents.loadURL(url).catch(() => {})
  })

  ipcMain.handle('webview:back', () => {
    if (view?.webContents.canGoBack()) view.webContents.goBack()
  })

  ipcMain.handle('webview:forward', () => {
    if (view?.webContents.canGoForward()) view.webContents.goForward()
  })

  ipcMain.handle('webview:reload', () => {
    view?.webContents.reload()
  })

  ipcMain.handle('webview:close', () => {
    closeWebview()
  })

  ipcMain.handle('webview:eject', () => {
    if (!view) return
    const url = view.webContents.getURL()
    if (url) shell.openExternal(url).catch(() => {})
    closeWebview()  // close panel after ejecting to browser
  })

  ipcMain.handle('webview:resize', (_e, input) => {
    const [cw, ch] = mainWin?.getContentSize() ?? [1280, 800]
    if (getPosition() === 'bottom') {
      const raw = typeof input?.height === 'number' ? input.height : PANEL_DEFAULT_H
      panelH = Math.max(PANEL_MIN_H, Math.min(raw, Math.floor(ch * 0.6)))
    } else {
      const raw = typeof input?.width === 'number' ? input.width : PANEL_DEFAULT_W
      panelW = Math.max(PANEL_MIN_W, Math.min(raw, Math.floor(cw * 0.7)))
    }
    updateBounds()
  })
}
