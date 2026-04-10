import type Database from 'better-sqlite3'

// Migration 004 - add global_shortcut column to settings
// Stores the user's chosen globalShortcut accelerator string.
// Default: 'CommandOrControl+Shift+Space' (cross-platform; resolves to
// Ctrl+Shift+Space on Windows and Cmd+Shift+Space on macOS).

export function migration004(db: Database.Database): void {
  try {
    db.exec(`
      ALTER TABLE settings
      ADD COLUMN global_shortcut TEXT NOT NULL DEFAULT 'CommandOrControl+Shift+Space'
    `)
  } catch {
    // Column already exists - migration was already applied. Safe to ignore.
  }
}
