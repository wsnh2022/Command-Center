import Database from 'better-sqlite3'
import { Paths } from '../utils/paths'
import { runMigrations } from './migrations/001_initial'
import { migration002 } from './migrations/002_item_type_refactor'
import { migration003 } from './migrations/003_icon_color'
import { migration004 } from './migrations/004_global_shortcut'
import { migration005 } from './migrations/005_indexes'
import { migration006 } from './migrations/006_hover_navigate'
import { migration007 } from './migrations/007_remove_small_font'
import { migration008 } from './migrations/008_group_icon_source'

let db: Database.Database | null = null

// Returns the singleton DB instance — initializes on first call
export function getDb(): Database.Database {
  if (db) return db

  db = new Database(Paths.db) // opens or creates the DB file

  // WAL mode: allows concurrent reads while writing — faster for Electron
  db.pragma('journal_mode = WAL')

  // Enforce FK constraints — SQLite disables them by default
  db.pragma('foreign_keys = ON')

  // Run schema migrations on every startup — no-ops if already up to date
  runMigrations(db)   // 001 — initial schema
  migration002(db)    // 002 — add command_args/working_dir/action_id, rename type values
  migration003(db)    // 003 — add icon_color column
  migration004(db)    // 004 — add global_shortcut column to settings
  migration005(db)    // 005 — supplemental indexes (recents.item_id, item_tags.tag_id)
  migration006(db)    // 006 — add hover_navigate column to settings
  migration007(db)    // 007 — migrate 'small' font_size rows to 'medium'
  migration008(db)    // 008 — add icon_source, icon_color to groups

  return db
}

// Close DB cleanly — called on app quit
export function closeDb(): void {
  if (db) {
    db.close()
    db = null
  }
}
