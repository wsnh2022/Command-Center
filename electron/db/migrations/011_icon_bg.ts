/**
 * Migration 011 - Icon background per item
 *
 * Adds `icon_bg` column to `items` table.
 * Stores one of: '' | 'white' | 'black' | 'transparent'
 * '' = default - transparent for all sources.
 * Only applied to img-rendered icons (favicon, auto, custom, url-icon, b64-icon).
 *
 * Safe to run on a fresh DB or an existing one with data.
 * ALTER TABLE ADD COLUMN guarded by try/catch - idempotent.
 */
import type Database from 'better-sqlite3'

export function migration011(db: Database.Database): void {
  try {
    db.exec(`ALTER TABLE items ADD COLUMN icon_bg TEXT NOT NULL DEFAULT ''`)
  } catch {
    // Column already exists - migration was already applied. Safe to skip.
  }
}
