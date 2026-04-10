import type Database from 'better-sqlite3'

// Migration 010 - add sidebar_header_label to settings
// Allows the user to rename the static "Groups" divider at the top of the sidebar.

const MIGRATION_VERSION = 10

export function migration010(db: Database.Database): void {
  const currentVersion = db.pragma('user_version', { simple: true }) as number
  if (currentVersion >= MIGRATION_VERSION) return

  db.transaction(() => {
    db.exec(`
      ALTER TABLE settings ADD COLUMN sidebar_header_label TEXT NOT NULL DEFAULT 'Groups';
    `)
    db.pragma(`user_version = ${MIGRATION_VERSION}`)
  })()
}
