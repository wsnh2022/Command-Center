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
import { registerTrayHandlers, destroyTray } from './ipc/tray.ipc'
import { registerShortcutHandlers, unregisterShortcuts } from './ipc/shortcuts.ipc'

// Register command-center-asset:// protocol BEFORE app is ready (required by Electron)
// Serves files from %APPDATA%\Command-Center\ securely without exposing the full filesystem
protocol.registerSchemesAsPrivileged([
  { scheme: 'command-center-asset', privileges: { secure: true, supportFetchAPI: true, bypassCSP: false } }
])

// Prevent multiple instances — enforce single app window
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
  process.exit(0)
}

let mainWindow: BrowserWindow | null = null

function initializeApp(): void {
  ensureDirectories()  // create %APPDATA%\Command-Center\ dirs if missing
  getDb()              // open DB + run migrations before window loads
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

  // Sync Windows startup entry to match stored setting on every launch
  try {
    const settings = getSettings(getDb())
    app.setLoginItemSettings({ openAtLogin: settings.launchOnStartup })
  } catch { /* non-fatal — DB may not be ready on very first launch before migration */ }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,

    center: true,
    show: false,                  // hold until ready-to-show to prevent flash
    frame: false,                 // frameless — custom drag region in renderer (TopBar)
    backgroundColor: '#0a0a0a',   // matches --surface-0 dark theme, prevents white flash
    title: 'Command-Center',
    icon: join(__dirname, '../../public/icon.ico'),  // taskbar + alt-tab icon — uses project asset, not Electron default
    webPreferences: {
      preload: join(__dirname, '../preload/preload.mjs'),
      sandbox: false,             // required for contextBridge + better-sqlite3 access
      contextIsolation: true,     // keeps renderer sandboxed from Node
      nodeIntegration: false,     // never expose Node directly to renderer
      spellcheck: true,           // enables Windows native spell checker in text fields
    },
  })

  mainWindow.once('ready-to-show', () => { mainWindow?.show() })

  // Spell-check + edit context menu.
  // Uses params.editFlags instead of params.isEditable — editFlags is reliable for
  // React-controlled textareas where isEditable can incorrectly return false.
  // Also catches fields by inputFieldType so the menu always appears in text inputs.
  mainWindow.webContents.on('context-menu', (_event, params) => {
    // Temporary debug — remove after confirming spell check works
    console.log('[context-menu] isEditable:', params.isEditable, '| inputFieldType:', params.inputFieldType, '| misspelledWord:', JSON.stringify(params.misspelledWord), '| suggestions:', params.dictionarySuggestions)

    const inTextField = params.isEditable || params.inputFieldType !== 'none'
    const f = params.editFlags

    // Only show menu when inside a text field
    if (!inTextField && !params.misspelledWord) return

    const menu = new Menu()

    // Spell check corrections — only when right-clicked on a red-underlined word
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

    // Standard edit actions — driven by editFlags, accurate for React textareas
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
  if (mainWindow) registerWebviewHandlers(mainWindow)   // needs window ref — called after createWindow
  if (mainWindow) registerTrayHandlers(mainWindow)      // tray needs window ref — hide-to-tray wired here
  if (mainWindow) registerShortcutHandlers(mainWindow)  // global shortcut — reads stored accelerator from DB

  // Serve local icon files via command-center-asset:// protocol
  // Usage in renderer: <img src="command-center-asset://assets/icons/abc.png" />
  // Maps command-center-asset://relative/path → %APPDATA%\Command-Center\relative\path
  protocol.handle('command-center-asset', (request) => {
    const relativePath = decodeURIComponent(request.url.replace('command-center-asset://', ''))
    // Security: normalize path and ensure it stays within userData
    const safePath = normalize(join(Paths.userData, relativePath))
    if (!safePath.startsWith(Paths.userData)) {
      return new Response('Forbidden', { status: 403 })
    }
    // Windows fix: backslashes → forward slashes, triple-slash required
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
