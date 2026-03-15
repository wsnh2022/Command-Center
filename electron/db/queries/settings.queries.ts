import type Database from 'better-sqlite3'
import type { AppSettings } from '../../types'

function rowToSettings(row: Record<string, unknown>): AppSettings {
  return {
    theme:            row.theme as AppSettings['theme'],
    fontSize:         row.font_size as AppSettings['fontSize'],
    density:          row.density as AppSettings['density'],
    launchOnStartup:  row.launch_on_startup === 1,
    minimizeToTray:   row.minimize_to_tray === 1,
    webviewPosition:  row.webview_position as AppSettings['webviewPosition'],
    webviewWidth:     row.webview_width as number,
    lastActiveGroup:  row.last_active_group as string,
    globalShortcut:   (row.global_shortcut as string) || 'CommandOrControl+Shift+Space',
    updatedAt:        row.updated_at as string,
  }
}

export function getSettings(db: Database.Database): AppSettings {
  const row = db.prepare(`SELECT * FROM settings WHERE id = 'app'`).get()
  if (!row) throw new Error('Settings row missing — migration may not have run')
  return rowToSettings(row as Record<string, unknown>)
}

export function updateSettings(db: Database.Database, input: Partial<AppSettings>): AppSettings {
  const ts = new Date().toISOString()

  db.prepare(`
    UPDATE settings SET
      theme             = COALESCE(?, theme),
      font_size         = COALESCE(?, font_size),
      density           = COALESCE(?, density),
      launch_on_startup = COALESCE(?, launch_on_startup),
      minimize_to_tray  = COALESCE(?, minimize_to_tray),
      webview_position  = COALESCE(?, webview_position),
      webview_width     = COALESCE(?, webview_width),
      last_active_group = COALESCE(?, last_active_group),
      global_shortcut   = COALESCE(?, global_shortcut),
      updated_at        = ?
    WHERE id = 'app'
  `).run(
    input.theme ?? null,
    input.fontSize ?? null,
    input.density ?? null,
    input.launchOnStartup !== undefined ? (input.launchOnStartup ? 1 : 0) : null,
    input.minimizeToTray !== undefined ? (input.minimizeToTray ? 1 : 0) : null,
    input.webviewPosition ?? null,
    input.webviewWidth ?? null,
    input.lastActiveGroup ?? null,
    input.globalShortcut ?? null,
    ts
  )

  return getSettings(db)
}
