import type Database from 'better-sqlite3'
import type { RecentItem } from '../../types'
import { v4 as uuid } from 'uuid'

const MAX_RECENTS = 20

function rowToRecent(row: Record<string, unknown>): RecentItem {
  return {
    id:         row.id as string,
    itemId:     row.item_id as string,
    launchedAt: row.launched_at as string,
    item: {
      id:          row.item_id as string,
      cardId:      row.card_id as string,
      label:       row.label as string,
      path:        row.path as string,
      type:        row.type as RecentItem['item']['type'],
      iconPath:    row.icon_path as string,
      iconSource:  row.icon_source as RecentItem['item']['iconSource'],
      note:        row.note as string,
      tags:        row.tags ? (row.tags as string).split(',').filter(Boolean) : [],
      commandArgs: (row.command_args as string) ?? '',
      workingDir:  (row.working_dir  as string) ?? '',
      actionId:    '',   // column retained for DB compat — always '' for new items
      sortOrder:   row.sort_order as number,
      launchCount: row.launch_count as number,
      createdAt:   row.item_created_at as string,
      updatedAt:   row.item_updated_at as string,
    }
  }
}

export function getRecents(db: Database.Database, limit = MAX_RECENTS): RecentItem[] {
  const rows = db.prepare(`
    SELECT
      r.id, r.item_id, r.launched_at,
      i.card_id, i.label, i.path, i.type, i.icon_path, i.icon_source,
      i.note, i.sort_order, i.launch_count, i.command_args, i.working_dir,
      i.created_at as item_created_at, i.updated_at as item_updated_at,
      GROUP_CONCAT(t.name, ',') as tags
    FROM recents r
    JOIN items i ON i.id = r.item_id
    LEFT JOIN item_tags it ON it.item_id = i.id
    LEFT JOIN tags t ON t.id = it.tag_id
    GROUP BY r.id
    ORDER BY r.launched_at DESC
    LIMIT ?
  `).all(limit)
  return rows.map(r => rowToRecent(r as Record<string, unknown>))
}

export function recordLaunch(db: Database.Database, itemId: string): void {
  const ts = new Date().toISOString()

  // Delete existing recent row for this item (recents has no UNIQUE on item_id)
  // then insert fresh — equivalent to upsert, updates the timestamp to now
  db.prepare(`DELETE FROM recents WHERE item_id = ?`).run(itemId)
  db.prepare(`INSERT INTO recents (id, item_id, launched_at) VALUES (?, ?, ?)`).run(uuid(), itemId, ts)

  // Trim recents to max — delete oldest entries beyond the cap
  db.prepare(`
    DELETE FROM recents WHERE id NOT IN (
      SELECT id FROM recents ORDER BY launched_at DESC LIMIT ?
    )
  `).run(MAX_RECENTS)
}
