import type Database from 'better-sqlite3'

/**
 * Migration 007 — remove 'small' font size option
 *
 * 'small' mapped to 13px — too small for legibility on dark surfaces
 * with Tailwind text-xs classes compounding the reduction.
 *
 * Any row storing 'small' is migrated to 'medium' (15px default).
 * 'medium' and 'large' (17px) are the only valid values going forward.
 */
export function migration007(db: Database.Database): void {
  db.prepare(`
    UPDATE settings
    SET font_size = 'medium'
    WHERE font_size = 'small'
  `).run()
}
