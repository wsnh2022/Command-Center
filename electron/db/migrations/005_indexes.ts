import type Database from 'better-sqlite3'

/**
 * Migration 005 — Supplemental indexes
 *
 * Adds two indexes that were missing from the initial schema:
 *
 *   idx_recents_item   — recents(item_id)
 *     The recents query joins items ON item_id. Without an index on item_id
 *     SQLite does a per-row table scan on the items table. With max 20 recents
 *     the cost is negligible today, but the index is free to add and keeps
 *     query plans clean as the dataset grows.
 *
 *   idx_item_tags_tag  — item_tags(tag_id)
 *     The item_tags junction table already has idx_item_tags_item on item_id
 *     (for "what tags does item X have?"). This adds the reverse direction
 *     (for "which items have tag Y?"), needed for any tag-based filtering.
 *
 * Both CREATE INDEX statements are guarded with IF NOT EXISTS — idempotent
 * on repeated runs and safe on a fresh DB.
 */
export function migration005(db: Database.Database): void {
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_recents_item  ON recents(item_id)`)
  } catch { /* ignore — already exists */ }

  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_item_tags_tag ON item_tags(tag_id)`)
  } catch { /* ignore — already exists */ }
}
