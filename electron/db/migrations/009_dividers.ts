import type Database from 'better-sqlite3'

// Migration 009 - sidebar dividers table
// Dividers are decorative separators positioned after a specific group.
// ON DELETE CASCADE removes the divider automatically when its anchor group is deleted.

const MIGRATION_VERSION = 9

export function migration009(db: Database.Database): void {
  const currentVersion = db.pragma('user_version', { simple: true }) as number
  if (currentVersion >= MIGRATION_VERSION) return

  db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS dividers (
        id             TEXT PRIMARY KEY,
        label          TEXT    NOT NULL DEFAULT '',
        after_group_id TEXT    NOT NULL,
        sort_order     INTEGER NOT NULL DEFAULT 0,
        created_at     TEXT    NOT NULL,
        updated_at     TEXT    NOT NULL,
        FOREIGN KEY (after_group_id) REFERENCES groups(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_dividers_group ON dividers(after_group_id);
    `)

    db.pragma(`user_version = ${MIGRATION_VERSION}`)
  })()
}
