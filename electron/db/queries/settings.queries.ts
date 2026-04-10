import type Database from 'better-sqlite3'
import type { AppSettings } from '@shared/types'

function rowToSettings(row: Record<string, unknown>): AppSettings {
  return {
    theme:            row.theme as AppSettings['theme'],
    fontSize:         row.font_size as AppSettings['fontSize'],
    density:          row.density as AppSettings['density'],
    launchOnStartup:  row.launch_on_startup === 1,
    minimizeToTray:   row.minimize_to_tray === 1,
    webviewWidth:     row.webview_width as number,
    lastActiveGroup:  row.last_active_group as string,
    globalShortcut:   (row.global_shortcut as string) || 'CommandOrControl+Shift+Space',
    hoverNavigate:       row.hover_navigate === 1,
    sidebarHeaderLabel:  (row.sidebar_header_label as string) || 'Groups',
    updatedAt:           row.updated_at as string,
  }
}

export function getSettings(db: Database.Database): AppSettings {
  const row = db.prepare(`SELECT * FROM settings WHERE id = 'app'`).get()
  if (!row) throw new Error('Settings row missing - migration may not have run')
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
      webview_width     = COALESCE(?, webview_width),
      last_active_group = COALESCE(?, last_active_group),
      global_shortcut   = COALESCE(?, global_shortcut),
      hover_navigate        = COALESCE(?, hover_navigate),
      sidebar_header_label  = COALESCE(?, sidebar_header_label),
      updated_at            = ?
    WHERE id = 'app'
  `).run(
    input.theme ?? null,
    input.fontSize ?? null,
    input.density ?? null,
    input.launchOnStartup !== undefined ? (input.launchOnStartup ? 1 : 0) : null,
    input.minimizeToTray !== undefined ? (input.minimizeToTray ? 1 : 0) : null,
    input.webviewWidth ?? null,
    input.lastActiveGroup ?? null,
    input.globalShortcut ?? null,
    input.hoverNavigate !== undefined ? (input.hoverNavigate ? 1 : 0) : null,
    input.sidebarHeaderLabel ?? null,
    ts
  )

  return getSettings(db)
}
