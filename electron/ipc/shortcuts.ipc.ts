/**
 * shortcuts.ipc.ts
 * Global keyboard shortcut registration for Command-Center.
 *
 * Manages a single "show / hide window" accelerator that works system-wide,
 * even when Command-Center is minimized or hidden to the tray.
 *
 * IPC surface:
 *   shortcuts:get    → { accelerator: string }
 *   shortcuts:set    → { success: boolean } | throws on conflict / invalid
 *   shortcuts:reset  → { accelerator: string } (restores default)
 *
 * Call registerShortcutHandlers(mainWindow) after createWindow() in index.ts.
 * Call unregisterShortcuts() on app.beforeQuit - required by Electron.
 */

import { app, globalShortcut, ipcMain, BrowserWindow } from 'electron'
import { getDb } from '../db/database'
import { getSettings, updateSettings } from '../db/queries/settings.queries'

const DEFAULT_ACCELERATOR = 'CommandOrControl+Shift+Space'

// ─── Internal helpers ────────────────────────────────────────────────────────

function getStoredAccelerator(): string {
  try {
    return getSettings(getDb()).globalShortcut || DEFAULT_ACCELERATOR
  } catch {
    return DEFAULT_ACCELERATOR
  }
}

/**
 * Register the given accelerator to toggle the window.
 * Unregisters any previously registered shortcut first.
 * Throws a descriptive Error if the accelerator is already taken by another app.
 */
function applyShortcut(win: BrowserWindow, accelerator: string): void {
  // Unregister all existing Command-Center shortcuts before registering the new one
  globalShortcut.unregisterAll()

  const registered = globalShortcut.register(accelerator, () => {
    if (win.isVisible() && win.isFocused()) {
      win.hide()
    } else {
      win.show()
      win.focus()
    }
  })

  if (!registered) {
    // Another app owns this key combo - restore the previous shortcut so the
    // user doesn't end up with no shortcut at all
    const fallback = getStoredAccelerator()
    if (fallback !== accelerator) {
      globalShortcut.register(fallback, () => {
        if (win.isVisible() && win.isFocused()) {
          win.hide()
        } else {
          win.show()
          win.focus()
        }
      })
    }
    throw new Error(`Shortcut "${accelerator}" is already in use by another application.`)
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function registerShortcutHandlers(win: BrowserWindow): void {
  // Register the stored shortcut on startup
  const stored = getStoredAccelerator()
  try {
    applyShortcut(win, stored)
  } catch {
    // Stored shortcut is conflicting (e.g. after an OS update) - silently skip.
    // The user can reassign from ShortcutsPage.
  }

  // Unregister all shortcuts cleanly on quit
  app.on('before-quit', () => {
    globalShortcut.unregisterAll()
  })

  // ── shortcuts:get ──────────────────────────────────────────────────────────
  // Returns the currently stored accelerator string.
  ipcMain.handle('shortcuts:get', () => {
    return { accelerator: getStoredAccelerator() }
  })

  // ── shortcuts:set ──────────────────────────────────────────────────────────
  // Validates, registers, and persists a new accelerator.
  // Throws (rejects) if the shortcut is already taken by another app.
  ipcMain.handle('shortcuts:set', (_event, { accelerator }: { accelerator: string }) => {
    if (!accelerator || typeof accelerator !== 'string') {
      throw new Error('Invalid accelerator')
    }
    // Apply first - throws if conflict detected
    applyShortcut(win, accelerator)
    // Only persist after successful registration
    updateSettings(getDb(), { globalShortcut: accelerator })
    return { success: true, accelerator }
  })

  // ── shortcuts:reset ────────────────────────────────────────────────────────
  // Restores the default accelerator and persists it.
  ipcMain.handle('shortcuts:reset', () => {
    try {
      applyShortcut(win, DEFAULT_ACCELERATOR)
    } catch {
      // Default is somehow taken - just unregister everything
      globalShortcut.unregisterAll()
    }
    updateSettings(getDb(), { globalShortcut: DEFAULT_ACCELERATOR })
    return { success: true, accelerator: DEFAULT_ACCELERATOR }
  })
}

export function unregisterShortcuts(): void {
  globalShortcut.unregisterAll()
}
