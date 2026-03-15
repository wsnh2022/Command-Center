import { ipcMain, app } from 'electron'
import { getDb } from '../db/database'
import { getSettings, updateSettings } from '../db/queries/settings.queries'
import { sanitizeString } from '../utils/sanitize'

export function registerSettingsHandlers(): void {

  ipcMain.handle('settings:get', () => {
    return getSettings(getDb())
  })

  ipcMain.handle('settings:update', (_e, input) => {
    if (!input || typeof input !== 'object') throw new Error('Invalid settings input')

    const allowed = ['dark', 'light']
    const allowedFontSize = ['small', 'medium', 'large']
    const allowedDensity = ['compact', 'comfortable']
    const allowedWebviewPos = ['right', 'bottom']

    const updated = updateSettings(getDb(), {
      theme:            input.theme && allowed.includes(input.theme) ? input.theme : undefined,
      fontSize:         input.fontSize && allowedFontSize.includes(input.fontSize) ? input.fontSize : undefined,
      density:          input.density && allowedDensity.includes(input.density) ? input.density : undefined,
      launchOnStartup:  typeof input.launchOnStartup === 'boolean' ? input.launchOnStartup : undefined,
      minimizeToTray:   typeof input.minimizeToTray === 'boolean' ? input.minimizeToTray : undefined,
      webviewPosition:  input.webviewPosition && allowedWebviewPos.includes(input.webviewPosition) ? input.webviewPosition : undefined,
      webviewWidth:     typeof input.webviewWidth === 'number' ? input.webviewWidth : undefined,
      lastActiveGroup:  input.lastActiveGroup !== undefined ? sanitizeString(input.lastActiveGroup, 36) : undefined,
    })

    // Sync Windows startup entry whenever launchOnStartup changes
    if (typeof input.launchOnStartup === 'boolean') {
      try {
        app.setLoginItemSettings({ openAtLogin: updated.launchOnStartup })
      } catch { /* not fatal — Windows-only, silently skip on other platforms */ }
    }

    return updated
  })
}
