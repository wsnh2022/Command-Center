/**
 * Migration 003 - Icon colour per item
 *
 * Adds `icon_color` column to `items` table.
 * Stores a hex colour string (e.g. '#6366f1') or '' for no override.
 * Only rendered when iconSource === 'library' - ignored for all other sources.
 *
 * Safe to run on a fresh DB or an existing one with data.
 * ALTER TABLE ADD COLUMN guarded by try/catch - idempotent.
 */
import type Database from 'better-sqlite3'

export function migration003(db: Database.Database): void {
  try {
    db.exec(`ALTER TABLE items ADD COLUMN icon_color TEXT NOT NULL DEFAULT ''`)
  } catch {
    // Column already exists - migration was already applied. Safe to skip.
  }
}
