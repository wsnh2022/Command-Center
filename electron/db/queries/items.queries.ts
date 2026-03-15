import type Database from 'better-sqlite3'
import type { Item, CreateItemInput, UpdateItemInput, SearchIndexEntry } from '../../types'
import { v4 as uuid } from 'uuid'

function now(): string {
  return new Date().toISOString()
}

// DB row has tags as a comma-separated string from GROUP_CONCAT
function rowToItem(row: Record<string, unknown>): Item {
  return {
    id:          row.id as string,
    cardId:      row.card_id as string,
    label:       row.label as string,
    path:        row.path as string,
    type:        row.type as Item['type'],
    iconPath:    row.icon_path as string,
    iconSource:  row.icon_source as Item['iconSource'],
    note:        row.note as string,
    tags:        row.tags ? (row.tags as string).split(',').filter(Boolean) : [],
    commandArgs: (row.command_args as string) ?? '',
    workingDir:  (row.working_dir  as string) ?? '',
    actionId:    (row.action_id    as string) ?? '',
    iconColor:   (row.icon_color   as string) ?? '',
    sortOrder:   row.sort_order as number,
    launchCount: row.launch_count as number,
    createdAt:   row.created_at as string,
    updatedAt:   row.updated_at as string,
  }
}

// Items with tags joined — used for card display and search index
const ITEM_WITH_TAGS_SQL = `
  SELECT i.*, GROUP_CONCAT(t.name, ',') as tags
  FROM items i
  LEFT JOIN item_tags it ON it.item_id = i.id
  LEFT JOIN tags t ON t.id = it.tag_id
  WHERE i.card_id = ?
  GROUP BY i.id
  ORDER BY i.sort_order ASC
`

export function getItemsByCard(db: Database.Database, cardId: string): Item[] {
  const rows = db.prepare(ITEM_WITH_TAGS_SQL).all(cardId)
  return rows.map(r => rowToItem(r as Record<string, unknown>))
}

export function getAllItems(db: Database.Database): Item[] {
  const rows = db.prepare(`
    SELECT i.*, GROUP_CONCAT(t.name, ',') as tags
    FROM items i
    LEFT JOIN item_tags it ON it.item_id = i.id
    LEFT JOIN tags t ON t.id = it.tag_id
    GROUP BY i.id
    ORDER BY i.card_id, i.sort_order ASC
  `).all()
  return rows.map(r => rowToItem(r as Record<string, unknown>))
}

export function getItemById(db: Database.Database, id: string): Item | null {
  const row = db.prepare(`
    SELECT i.*, GROUP_CONCAT(t.name, ',') as tags
    FROM items i
    LEFT JOIN item_tags it ON it.item_id = i.id
    LEFT JOIN tags t ON t.id = it.tag_id
    WHERE i.id = ?
    GROUP BY i.id
  `).get(id)
  return row ? rowToItem(row as Record<string, unknown>) : null
}

// Sync tag associations for an item — upserts tags, replaces item_tags
function syncTags(db: Database.Database, itemId: string, tagNames: string[]): void {
  db.prepare(`DELETE FROM item_tags WHERE item_id = ?`).run(itemId)

  for (const name of tagNames) {
    if (!name.trim()) continue
    const tagId = uuid()
    // Insert tag if not exists — UNIQUE constraint on name handles duplicates
    db.prepare(`INSERT OR IGNORE INTO tags (id, name) VALUES (?, ?)`).run(tagId, name.trim())
    const tag = db.prepare(`SELECT id FROM tags WHERE name = ?`).get(name.trim()) as { id: string }
    db.prepare(`INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?, ?)`).run(itemId, tag.id)
  }
}

export function createItem(db: Database.Database, input: CreateItemInput): Item {
  const id = uuid()
  const ts = now()
  const maxOrder = db.prepare(
    `SELECT MAX(sort_order) as m FROM items WHERE card_id = ?`
  ).get(input.cardId) as { m: number | null }
  const sortOrder = (maxOrder.m ?? -1) + 1

  db.prepare(`
    INSERT INTO items (id, card_id, label, path, type, icon_path, icon_source, note,
                       command_args, working_dir, action_id, icon_color,
                       sort_order, launch_count, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
  `).run(
    id,
    input.cardId,
    input.label,
    input.path,
    input.type,
    input.iconPath ?? '',
    input.iconSource ?? 'auto',
    input.note ?? '',
    input.commandArgs ?? '',
    input.workingDir  ?? '',
    input.actionId    ?? '',
    input.iconColor   ?? '',
    sortOrder,
    ts,
    ts
  )

  if (input.tags?.length) syncTags(db, id, input.tags)

  return getItemById(db, id)!
}

export function updateItem(db: Database.Database, input: UpdateItemInput): Item | null {
  const ts = now()
  db.prepare(`
    UPDATE items
    SET label       = COALESCE(?, label),
        path        = COALESCE(?, path),
        type        = COALESCE(?, type),
        icon_path   = COALESCE(?, icon_path),
        icon_source = COALESCE(?, icon_source),
        note        = COALESCE(?, note),
        command_args= COALESCE(?, command_args),
        working_dir = COALESCE(?, working_dir),
        action_id   = COALESCE(?, action_id),
        icon_color  = COALESCE(?, icon_color),
        sort_order  = COALESCE(?, sort_order),
        updated_at  = ?
    WHERE id = ?
  `).run(
    input.label       ?? null,
    input.path        ?? null,
    input.type        ?? null,
    input.iconPath    ?? null,
    input.iconSource  ?? null,
    input.note        ?? null,
    input.commandArgs ?? null,
    input.workingDir  ?? null,
    input.actionId    ?? null,
    input.iconColor   ?? null,
    input.sortOrder   ?? null,
    ts,
    input.id
  )

  if (input.tags !== undefined) syncTags(db, input.id, input.tags)

  return getItemById(db, input.id)
}

export function deleteItem(db: Database.Database, id: string): boolean {
  const result = db.prepare(`DELETE FROM items WHERE id = ?`).run(id)
  return result.changes > 0
}

export function moveItem(db: Database.Database, itemId: string, targetCardId: string): boolean {
  const ts = now()
  const maxOrder = db.prepare(
    `SELECT MAX(sort_order) as m FROM items WHERE card_id = ?`
  ).get(targetCardId) as { m: number | null }
  const sortOrder = (maxOrder.m ?? -1) + 1

  const result = db.prepare(`
    UPDATE items SET card_id = ?, sort_order = ?, updated_at = ? WHERE id = ?
  `).run(targetCardId, sortOrder, ts, itemId)
  return result.changes > 0
}

export function incrementLaunchCount(db: Database.Database, id: string): void {
  db.prepare(`UPDATE items SET launch_count = launch_count + 1, updated_at = ? WHERE id = ?`)
    .run(new Date().toISOString(), id)
}

// Full search index — all items with their card + group context
export function getSearchIndex(db: Database.Database): SearchIndexEntry[] {
  const rows = db.prepare(`
    SELECT
      i.id as itemId,
      i.label,
      i.path,
      i.type,
      i.note,
      GROUP_CONCAT(t.name, ',') as tags,
      c.id as cardId,
      c.name as cardName,
      g.id as groupId,
      g.name as groupName
    FROM items i
    JOIN cards c ON c.id = i.card_id
    JOIN groups g ON g.id = c.group_id
    LEFT JOIN item_tags it ON it.item_id = i.id
    LEFT JOIN tags t ON t.id = it.tag_id
    GROUP BY i.id
  `).all()

  return rows.map(r => {
    const row = r as Record<string, unknown>
    return {
      itemId:    row.itemId as string,
      label:     row.label as string,
      path:      row.path as string,
      type:      row.type as SearchIndexEntry['type'],
      note:      row.note as string,
      tags:      row.tags ? (row.tags as string).split(',').filter(Boolean) : [],
      cardId:    row.cardId as string,
      cardName:  row.cardName as string,
      groupId:   row.groupId as string,
      groupName: row.groupName as string,
    }
  })
}

// Bulk sort_order update — runs in a single transaction for atomicity
export function reorderItems(db: Database.Database, updates: { id: string; sortOrder: number }[]): void {
  const stmt = db.prepare(`UPDATE items SET sort_order = ?, updated_at = ? WHERE id = ?`)
  const ts = now()
  const run = db.transaction(() => {
    for (const { id, sortOrder } of updates) {
      stmt.run(sortOrder, ts, id)
    }
  })
  run()
}

// FTS5 full-text search on note content — returns matching item IDs
export function fullTextSearch(db: Database.Database, query: string): string[] {
  const rows = db.prepare(`
    SELECT i.id
    FROM items_fts
    JOIN items i ON i.rowid = items_fts.rowid
    WHERE items_fts MATCH ?
  `).all(query + '*') // trailing * enables prefix matching

  return rows.map(r => (r as { id: string }).id)
}
