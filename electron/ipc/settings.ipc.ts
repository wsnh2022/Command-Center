import { ipcMain } from 'electron'
import { getDb } from '../db/database'
import { getSettings, updateSettings } from '../db/queries/settings.queries'
import { sanitizeString } from '../utils/sanitize'
import { getStartupEnabled, setStartupEnabled } from '../services/startup.service'

export function registerSettingsHandlers(): void {

  ipcMain.handle('settings:get', () => {
    return getSettings(getDb())
  })

  ipcMain.handle('settings:update', (_e, input) => {
    if (!input || typeof input !== 'object') throw new Error('Invalid settings input')

    const allowed = ['dark', 'light']
    const allowedFontSize = ['small', 'medium', 'large']
    const allowedDensity = ['compact', 'comfortable']

    const updated = updateSettings(getDb(), {
      theme:            input.theme && allowed.includes(input.theme) ? input.theme : undefined,
      fontSize:         input.fontSize && allowedFontSize.includes(input.fontSize) ? input.fontSize : undefined,
      density:          input.density && allowedDensity.includes(input.density) ? input.density : undefined,
      launchOnStartup:  typeof input.launchOnStartup === 'boolean' ? input.launchOnStartup : undefined,
      minimizeToTray:   typeof input.minimizeToTray === 'boolean' ? input.minimizeToTray : undefined,
      webviewWidth:     typeof input.webviewWidth === 'number' ? input.webviewWidth : undefined,
      lastActiveGroup:     input.lastActiveGroup !== undefined ? sanitizeString(input.lastActiveGroup, 36) : undefined,
      hoverNavigate:       typeof input.hoverNavigate === 'boolean' ? input.hoverNavigate : undefined,
      sidebarHeaderLabel:  input.sidebarHeaderLabel !== undefined ? sanitizeString(input.sidebarHeaderLabel, 24) : undefined,
    })

    // Sync Windows Startup folder shortcut whenever launchOnStartup changes
    if (typeof input.launchOnStartup === 'boolean') {
      try {
        setStartupEnabled(updated.launchOnStartup)
      } catch { /* not fatal - silently skip */ }
    }

    return updated
  })

  // ── Direct startup IPC (used by renderer for accurate OS-level reads) ──────

  // Returns true/false by reading the OS Startup folder directly.
  // Never reads from the DB - the OS is always the source of truth.
  ipcMain.handle('startup:get', () => {
    return getStartupEnabled()
  })

  // Sets OS shortcut + keeps DB in sync.  Returns { success, error? }.
  ipcMain.handle('startup:set', (_e, input: { enabled: boolean }) => {
    if (typeof input?.enabled !== 'boolean') throw new Error('Invalid startup:set input')
    try {
      setStartupEnabled(input.enabled)
      updateSettings(getDb(), { launchOnStartup: input.enabled })
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })
}
