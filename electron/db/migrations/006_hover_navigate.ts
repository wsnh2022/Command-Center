import type Database from 'better-sqlite3'

/**
 * Migration 006 - add hover_navigate column to settings
 *
 * When enabled, hovering over a sidebar group pill for 300ms navigates to
 * that group automatically, without requiring a click.
 *
 * Default: 0 (disabled) - preserves existing click-only behaviour for all
 * users upgrading from an earlier version.
 */
export function migration006(db: Database.Database): void {
  try {
    db.exec(`
      ALTER TABLE settings
      ADD COLUMN hover_navigate INTEGER NOT NULL DEFAULT 0
    `)
  } catch {
    // Column already exists - migration already applied. Safe to ignore.
  }
}
