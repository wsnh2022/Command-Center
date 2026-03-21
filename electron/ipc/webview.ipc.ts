import { app, BrowserView, BrowserWindow, Menu, MenuItem, ipcMain, shell } from 'electron'
import { join } from 'path'
import { sanitizeUrl } from '../utils/sanitize'

const POPUP_W    = 800
const POPUP_H    = 560
const TITLEBAR_H = 56   // must match #titlebar height in popup.html
const MAX_POPUPS = 5    // each popup = ~80–200 MB RAM; cap prevents runaway memory use

let mainWin: BrowserWindow | null = null

// url  → popup BrowserWindow  (same URL reuses its popup)
const popups    = new Map<string, BrowserWindow>()
// winId → BrowserView          (navigation target for each popup)
const popupViews = new Map<number, BrowserView>()

/** Returns the main BrowserWindow reference, or null if not yet initialized. */
export function getMainWindow(): BrowserWindow | null { return mainWin }

/** Dev helper — logs RAM usage of every open popup to the terminal.
 *  Call from main process console or add a keybind in development. */
export function logPopupMemory(): void {
  if (!popupViews.size) { console.log('[popups] none open'); return }
  const metrics = app.getAppMetrics()
  for (const [winId, view] of popupViews) {
    const win      = BrowserWindow.fromId(winId)
    const title    = win?.getTitle() ?? `win#${winId}`
    const shellPid = win?.webContents.getOSProcessId()
    const viewPid  = view.webContents.getOSProcessId()
    const find     = (pid: number | undefined) =>
      metrics.find(m => m.pid === pid)?.memory
    const shellKB  = find(shellPid)?.privateBytes ?? find(shellPid)?.workingSetSize ?? 0
    const viewKB   = find(viewPid)?.privateBytes  ?? find(viewPid)?.workingSetSize  ?? 0
    console.log(`[popup] ${title}`)
    console.log(`        shell (popup.html): ${(shellKB / 1024).toFixed(1)} MB`)
    console.log(`        view  (website):    ${(viewKB  / 1024).toFixed(1)} MB`)
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function loadPopupHtml(win: BrowserWindow, url: string): void {
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    win.loadURL(`${devUrl}/popup.html?url=${encodeURIComponent(url)}`).catch(() => {})
  } else {
    win.loadFile(join(__dirname, '../renderer/popup.html'), { query: { url } }).catch(() => {})
  }
}

function updateViewBounds(win: BrowserWindow, view: BrowserView): void {
  const [w, h] = win.getContentSize()
  view.setBounds({ x: 0, y: TITLEBAR_H, width: w, height: Math.max(0, h - TITLEBAR_H) })
}

// ── Popup creation ───────────────────────────────────────────────────────────

function openPopup(url: string): void {
  // Reuse existing popup for the same URL
  const existing = popups.get(url)
  if (existing && !existing.isDestroyed()) {
    if (existing.isMinimized()) existing.restore()
    existing.focus()
    return
  }

  // Hard cap — each popup is a full Chromium renderer (~80–200 MB)
  if (popups.size >= MAX_POPUPS) {
    // Focus the oldest popup instead of opening a new one
    const oldest = popups.values().next().value
    if (oldest && !oldest.isDestroyed()) {
      if (oldest.isMinimized()) oldest.restore()
      oldest.focus()
    }
    return
  }

  // ── Shell window (title bar only — no webview tag needed) ──
  const win = new BrowserWindow({
    width:           POPUP_W,
    height:          POPUP_H,
    title:           url,   // shown in Windows Task Manager → Processes tab
    frame:           false,
    resizable:       true,
    backgroundColor: '#0a0a0a',
    webPreferences: {
      // Reuse the main preload — window:minimize/maximize/close in system.ipc.ts
      // use event.sender so they act on this popup, not mainWin.
      preload:          join(__dirname, '../preload/preload.mjs'),
      contextIsolation: true,
      nodeIntegration:  false,
      sandbox:          false,
    },
  })

  // ── BrowserView — sandboxed, isolated session ──
  // 'persist:webview' gives all popups shared, persistent cookies/localStorage
  // (so logging into a site once stays logged in across popups) while keeping
  // them completely isolated from the main app's session.defaultSession.
  const view = new BrowserView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration:  false,
      sandbox:          true,
      partition:        'persist:webview',
    },
  })

  win.setBrowserView(view)
  updateViewBounds(win, view)

  // Keep BrowserView sized correctly as the popup is resized
  win.on('resize', () => updateViewBounds(win, view))

  // ── Forward BrowserView events to popup renderer ──
  view.webContents.on('did-navigate', (_e, navUrl) => {
    win.webContents.send('popup:urlChanged', { url: navUrl })
  })

  view.webContents.on('did-navigate-in-page', (_e, navUrl, isMainFrame) => {
    if (!isMainFrame) return
    win.webContents.send('popup:urlChanged', { url: navUrl })
  })

  view.webContents.on('page-title-updated', (_e, title) => {
    const liveUrl = view.webContents.getURL() || url
    // Format: "Page Title — example.com" so Task Manager shows both
    const host = (() => { try { return new URL(liveUrl).hostname } catch { return liveUrl } })()
    win.setTitle(title ? `${title} — ${host}` : liveUrl)
    win.webContents.send('popup:titleChanged', { title })
  })

  view.webContents.on('did-start-loading', () => {
    win.webContents.send('popup:loadingStart')
  })

  view.webContents.on('did-stop-loading', () => {
    win.webContents.send('popup:loadingStopped')
  })

  // Block navigation to dangerous protocols (file://, javascript:, data:, etc.)
  view.webContents.on('will-navigate', (event, navUrl) => {
    try {
      const { protocol } = new URL(navUrl)
      if (protocol !== 'https:' && protocol !== 'http:') {
        event.preventDefault()
      }
    } catch {
      event.preventDefault()  // malformed URL
    }
  })

  // Right-click context menu — back / forward / reload / separator / open in browser
  view.webContents.on('context-menu', () => {
    const menu = new Menu()
    menu.append(new MenuItem({
      label:   'Back',
      enabled: view.webContents.canGoBack(),
      click:   () => view.webContents.goBack(),
    }))
    menu.append(new MenuItem({
      label:   'Forward',
      enabled: view.webContents.canGoForward(),
      click:   () => view.webContents.goForward(),
    }))
    menu.append(new MenuItem({
      label: 'Reload',
      click: () => view.webContents.reload(),
    }))
    menu.append(new MenuItem({ type: 'separator' }))
    menu.append(new MenuItem({
      label: 'Open in browser',
      click: () => {
        const url = view.webContents.getURL()
        if (url) shell.openExternal(url).catch(() => {})
      },
    }))
    menu.popup({ window: win })
  })

  // Open links that spawn new windows in the system browser
  view.webContents.setWindowOpenHandler(({ url: newUrl }) => {
    try {
      const { protocol } = new URL(newUrl)
      if (protocol === 'https:' || protocol === 'http:') {
        shell.openExternal(newUrl).catch(() => {})
      }
    } catch { /* invalid URL — ignore */ }
    return { action: 'deny' }
  })

  // Suspend BrowserView rendering while minimized — cuts CPU to ~0 for background popups
  win.on('minimize', () => { view.webContents.setFrameRate(1) })
  win.on('restore',  () => { view.webContents.setFrameRate(60) })

  // Live RAM badge — getProcessMemoryInfo() returns { private, shared } in KB
  // 'private' is a reserved word so use bracket notation
  const memInterval = setInterval(async () => {
    if (win.isDestroyed() || win.webContents.isDestroyed()) return
    try {
      const [shellMem, viewMem] = await Promise.all([
        win.webContents.getProcessMemoryInfo(),
        view.webContents.getProcessMemoryInfo(),
      ])
      const totalMB = Math.round((shellMem['private'] + viewMem['private']) / 1024)
      if (!win.isDestroyed()) win.webContents.send('popup:memoryUpdate', { mb: totalMB })
    } catch { /* window closing — ignore */ }
  }, 3000)

  win.on('closed', () => {
    clearInterval(memInterval)
    popupViews.delete(win.id)
    popups.delete(url)
  })

  popups.set(url, win)
  popupViews.set(win.id, view)

  // Load the popup shell HTML and the BrowserView simultaneously.
  // Once popup.html is ready, push the current URL + nav state so the
  // renderer doesn't miss events that fired before its listeners registered.
  loadPopupHtml(win, url)
  view.webContents.loadURL(url).catch(() => {})

  win.webContents.once('did-finish-load', () => {
    const liveUrl = view.webContents.getURL() || url
    win.webContents.send('popup:urlChanged', { url: liveUrl })
  })
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Opens a popup for the given URL. Same URL → focuses existing. Returns false if mainWin unset. */
export function openWebview(url: string): boolean {
  if (!mainWin) return false
  openPopup(url)
  return true
}

/** Call after createWindow() to bind the main window reference. */
export function registerWebviewHandlers(win: BrowserWindow): void {
  mainWin = win

  win.on('closed', () => {
    mainWin = null
    for (const popup of popups.values()) {
      if (!popup.isDestroyed()) popup.close()
    }
    popups.clear()
    popupViews.clear()
  })

  // Dev-only: call window.api.webview.memoryReport() from DevTools console
  // to print per-popup RAM to the terminal
  if (!win.webContents.isDestroyed()) {
    ipcMain.handle('webview:memoryReport', () => { logPopupMemory() })
  }

  // ── Main-window IPC (open / close / eject all) ──────────────────────────

  ipcMain.handle('webview:open', (_e, input) => {
    const url = sanitizeUrl(input?.url) || (input?.url as string) || ''
    if (url) openPopup(url)
  })

  ipcMain.handle('webview:close', () => {
    for (const popup of popups.values()) {
      if (!popup.isDestroyed()) popup.close()
    }
  })

  ipcMain.handle('webview:eject', () => {
    for (const [url, popup] of popups.entries()) {
      if (popup.isDestroyed()) continue
      const winId = popup.id
      const view  = popupViews.get(winId)
      const cur   = view?.webContents.getURL() || url
      shell.openExternal(cur).catch(() => {})
      popup.close()
    }
  })

  // No-ops — navigation is now per-popup via popup:* IPC below
  ipcMain.handle('webview:navigate', () => {})
  ipcMain.handle('webview:back',     () => {})
  ipcMain.handle('webview:forward',  () => {})
  ipcMain.handle('webview:reload',   () => {})

  // ── Per-popup IPC (sender-scoped via event.sender) ───────────────────────

  ipcMain.handle('popup:navigate', (event, input) => {
    const popupWin = BrowserWindow.fromWebContents(event.sender)
    if (!popupWin) return
    const view = popupViews.get(popupWin.id)
    if (!view || view.webContents.isDestroyed()) return
    const url = sanitizeUrl(input?.url) || (input?.url as string) || ''
    if (url) view.webContents.loadURL(url).catch(() => {})
  })

  ipcMain.handle('popup:reload', (event) => {
    const view = popupViews.get(BrowserWindow.fromWebContents(event.sender)?.id ?? -1)
    if (!view?.webContents.isDestroyed()) view?.webContents.reload()
  })

  ipcMain.handle('popup:eject', (event) => {
    const popupWin = BrowserWindow.fromWebContents(event.sender)
    if (!popupWin) return
    const view = popupViews.get(popupWin.id)
    const url  = view?.webContents.getURL() || ''
    if (url) shell.openExternal(url).catch(() => {})
    popupWin.close()
  })

  ipcMain.handle('popup:alwaysOnTop', (event, input) => {
    BrowserWindow.fromWebContents(event.sender)?.setAlwaysOnTop(!!input?.enabled)
  })
}
