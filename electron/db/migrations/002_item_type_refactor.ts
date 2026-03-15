/**
 * Migration 002 — Item type refactor
 *
 * Changes:
 *  1. Add command_args, working_dir, action_id columns to items
 *  2. Rename legacy type values: exe→software, script→command, ssh→action
 *
 * Safe to run on a fresh DB (UPDATE affects 0 rows if no items exist).
 * The FTS5 virtual table and its triggers are not affected.
 */
import type Database from 'better-sqlite3'

export function migration002(db: Database.Database): void {
  // Step 1 — add new columns (ALTER TABLE IF NOT EXISTS not supported in SQLite;
  // guard each with a try/catch in case migration was partially applied)
  const addColumn = (sql: string) => {
    try { db.exec(sql) } catch { /* column already exists — skip */ }
  }

  addColumn(`ALTER TABLE items ADD COLUMN command_args TEXT NOT NULL DEFAULT ''`)
  addColumn(`ALTER TABLE items ADD COLUMN working_dir  TEXT NOT NULL DEFAULT ''`)
  addColumn(`ALTER TABLE items ADD COLUMN action_id    TEXT NOT NULL DEFAULT ''`)

  // Step 2 — rename type values for existing rows
  db.prepare(`UPDATE items SET type = 'software' WHERE type = 'exe'`).run()
  db.prepare(`UPDATE items SET type = 'command'  WHERE type = 'script'`).run()
  db.prepare(`UPDATE items SET type = 'action'   WHERE type = 'ssh'`).run()
}
