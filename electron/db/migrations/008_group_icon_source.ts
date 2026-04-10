import type Database from 'better-sqlite3'

/**
 * Migration 008 - add icon_source and icon_color to groups table
 *
 * Groups previously stored only a Lucide icon name in `icon`.
 * Full icon system (emoji, upload, URL, base64) requires knowing
 * the source type and an optional colour for library icons.
 *
 * Defaults: icon_source = 'library' (existing rows are Lucide names)
 *           icon_color  = '' (no colour override)
 */
export function migration008(db: Database.Database): void {
  const cols = (db.prepare(`PRAGMA table_info(groups)`).all() as { name: string }[]).map(c => c.name)

  if (!cols.includes('icon_source')) {
    db.prepare(`ALTER TABLE groups ADD COLUMN icon_source TEXT NOT NULL DEFAULT 'library'`).run()
  }
  if (!cols.includes('icon_color')) {
    db.prepare(`ALTER TABLE groups ADD COLUMN icon_color TEXT NOT NULL DEFAULT ''`).run()
  }
}
