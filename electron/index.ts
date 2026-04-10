import { app, BrowserWindow, shell, protocol, net, Menu, MenuItem } from 'electron'
import { join, normalize } from 'path'
import { ensureDirectories } from './utils/paths'
import { getDb, closeDb } from './db/database'
import { Paths } from './utils/paths'
import { getSettings } from './db/queries/settings.queries'
import { registerGroupHandlers } from './ipc/groups.ipc'
import { registerCardHandlers } from './ipc/cards.ipc'
import { registerItemHandlers, registerSearchHandlers } from './ipc/items.ipc'
import { registerRecentHandlers } from './ipc/recents.ipc'
import { registerFavoriteHandlers } from './ipc/favorites.ipc'
import { registerSettingsHandlers } from './ipc/settings.ipc'
import { registerSystemHandlers } from './ipc/system.ipc'
import { registerWebviewHandlers } from './ipc/webview.ipc'
import { registerIconHandlers } from './ipc/icons.ipc'
import { registerBackupHandlers } from './ipc/backup.ipc'
import { registerDividerHandlers } from './ipc/dividers.ipc'
import { registerTrayHandlers, destroyTray } from './ipc/tray.ipc'
import { registerShortcutHandlers, unregisterShortcuts } from './ipc/shortcuts.ipc'
import { setStartupEnabled } from './services/startup.service'

protocol.registerSchemesAsPrivileged([
  { scheme: 'command-center-asset', privileges: { secure: true, supportFetchAPI: true, bypassCSP: false } }
])

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
  process.exit(0)
}

let mainWindow: BrowserWindow | null = null

function initializeApp(): void {
  ensureDirectories()
  getDb()
  registerGroupHandlers()
  registerCardHandlers()
  registerItemHandlers()
  registerSearchHandlers()
  registerRecentHandlers()
  registerFavoriteHandlers()
  registerSettingsHandlers()
  registerSystemHandlers()
  registerIconHandlers()
  registerBackupHandlers()
  registerDividerHandlers()

  // Sync OS Startup folder shortcut with DB preference on every launch.
  // Uses the portable-safe approach (Startup folder .lnk) instead of
  // app.setLoginItemSettings() which breaks on portable builds.
  try {
    const settings = getSettings(getDb())
    setStartupEnabled(settings.launchOnStartup)
  } catch { /* non-fatal */ }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1184,     // 224 sidebar + 4×240 card columns
    height: 800,
    minWidth: 704,   // 224 sidebar + 2×240 card columns (absolute floor)
    minHeight: 600,
    center: true,
    show: false,
    frame: false,
    backgroundColor: '#0a0a0a',
    title: 'Command-Center',
    icon: join(__dirname, '../../public/icon.ico'),
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true,
    },
  })

  mainWindow.once('ready-to-show', () => { mainWindow?.show() })

  // Spell-check + edit context menu - only fires for text fields.
  // Non-text-field right-clicks are handled entirely by React components.
  mainWindow.webContents.on('context-menu', (_event, params) => {
    const inTextField = params.isEditable || params.inputFieldType !== 'none'
    if (!inTextField && !params.misspelledWord) return

    const menu = new Menu()

    if (params.misspelledWord) {
      if (params.dictionarySuggestions.length > 0) {
        for (const suggestion of params.dictionarySuggestions) {
          menu.append(new MenuItem({
            label: suggestion,
            click: () => mainWindow?.webContents.replaceMisspelling(suggestion),
          }))
        }
      } else {
        menu.append(new MenuItem({ label: 'No suggestions', enabled: false }))
      }
      menu.append(new MenuItem({ type: 'separator' }))
      menu.append(new MenuItem({
        label: 'Add to dictionary',
        click: () => mainWindow?.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord),
      }))
      menu.append(new MenuItem({ type: 'separator' }))
    }

    const f = params.editFlags
    menu.append(new MenuItem({ role: 'undo',      label: 'Undo',       enabled: f.canUndo      }))
    menu.append(new MenuItem({ role: 'redo',      label: 'Redo',       enabled: f.canRedo      }))
    menu.append(new MenuItem({ type: 'separator' }))
    menu.append(new MenuItem({ role: 'cut',       label: 'Cut',        enabled: f.canCut       }))
    menu.append(new MenuItem({ role: 'copy',      label: 'Copy',       enabled: f.canCopy      }))
    menu.append(new MenuItem({ role: 'paste',     label: 'Paste',      enabled: f.canPaste     }))
    menu.append(new MenuItem({ role: 'selectAll', label: 'Select All', enabled: f.canSelectAll }))

    menu.popup()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  initializeApp()
  createWindow()
  if (mainWindow) registerWebviewHandlers(mainWindow)
  if (mainWindow) registerTrayHandlers(mainWindow)
  if (mainWindow) registerShortcutHandlers(mainWindow)

  protocol.handle('command-center-asset', (request) => {
    const relativePath = decodeURIComponent(request.url.replace('command-center-asset://', ''))
    const safePath = normalize(join(Paths.userData, relativePath))
    if (!safePath.startsWith(Paths.userData)) {
      return new Response('Forbidden', { status: 403 })
    }
    const fileUrl = 'file:///' + safePath.replace(/\\/g, '/')
    return net.fetch(fileUrl)
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    closeDb()
    destroyTray()
    unregisterShortcuts()
    app.quit()
  }
})

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})
