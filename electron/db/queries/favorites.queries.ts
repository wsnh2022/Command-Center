import type Database from 'better-sqlite3'
import type { FavoriteItem } from '../../types'
import { v4 as uuid } from 'uuid'

function rowToFavorite(row: Record<string, unknown>): FavoriteItem {
  return {
    id:        row.fav_id as string,
    itemId:    row.item_id as string,
    sortOrder: row.fav_sort as number,
    pinnedAt:  row.pinned_at as string,
    item: {
      id:          row.item_id as string,
      cardId:      row.card_id as string,
      label:       row.label as string,
      path:        row.path as string,
      type:        row.type as FavoriteItem['item']['type'],
      iconPath:    row.icon_path as string,
      iconSource:  row.icon_source as FavoriteItem['item']['iconSource'],
      note:        row.note as string,
      tags:        row.tags ? (row.tags as string).split(',').filter(Boolean) : [],
      commandArgs: (row.command_args as string) ?? '',
      workingDir:  (row.working_dir  as string) ?? '',
      actionId:    (row.action_id    as string) ?? '',
      sortOrder:   row.item_sort as number,
      launchCount: row.launch_count as number,
      createdAt:   row.item_created_at as string,
      updatedAt:   row.item_updated_at as string,
    },
  }
}

export function getFavorites(db: Database.Database): FavoriteItem[] {
  const rows = db.prepare(`
    SELECT
      f.id          AS fav_id,
      f.item_id,
      f.sort_order  AS fav_sort,
      f.pinned_at,
      i.card_id, i.label, i.path, i.type,
      i.icon_path, i.icon_source, i.note,
      i.sort_order  AS item_sort,
      i.launch_count,
      i.command_args, i.working_dir, i.action_id,
      i.created_at  AS item_created_at,
      i.updated_at  AS item_updated_at,
      GROUP_CONCAT(t.name, ',') AS tags
    FROM favorites f
    JOIN items i ON i.id = f.item_id
    LEFT JOIN item_tags it ON it.item_id = i.id
    LEFT JOIN tags t ON t.id = it.tag_id
    GROUP BY f.id
    ORDER BY f.sort_order ASC
  `).all()
  return rows.map(r => rowToFavorite(r as Record<string, unknown>))
}

export function pinItem(db: Database.Database, itemId: string): void {
  const res = db.prepare(`SELECT COALESCE(MAX(sort_order), -1) AS m FROM favorites`).get() as { m: number }
  // INSERT OR IGNORE — favorites.item_id has UNIQUE constraint; silently skips duplicates
  db.prepare(
    `INSERT OR IGNORE INTO favorites (id, item_id, sort_order, pinned_at) VALUES (?, ?, ?, ?)`
  ).run(uuid(), itemId, res.m + 1, new Date().toISOString())
}

export function unpinItem(db: Database.Database, itemId: string): void {
  db.prepare(`DELETE FROM favorites WHERE item_id = ?`).run(itemId)
}

export function reorderFavorites(db: Database.Database, favIds: string[]): void {
  // favIds = ordered array of favorites.id values (not item ids)
  const stmt = db.prepare(`UPDATE favorites SET sort_order = ? WHERE id = ?`)
  db.transaction(() => {
    favIds.forEach((id, idx) => stmt.run(idx, id))
  })()
}
