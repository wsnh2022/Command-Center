import type Database from 'better-sqlite3'
import type { Group, CreateGroupInput, UpdateGroupInput } from '../../types'
import { v4 as uuid } from 'uuid'

function now(): string {
  return new Date().toISOString()
}

// Map snake_case DB row to camelCase Group interface
function rowToGroup(row: Record<string, unknown>): Group {
  return {
    id:          row.id as string,
    name:        row.name as string,
    icon:        row.icon as string,
    accentColor: row.accent_color as string,
    sortOrder:   row.sort_order as number,
    createdAt:   row.created_at as string,
    updatedAt:   row.updated_at as string,
  }
}

export function getAllGroups(db: Database.Database): Group[] {
  const rows = db.prepare(`SELECT * FROM groups ORDER BY sort_order ASC`).all()
  return rows.map(r => rowToGroup(r as Record<string, unknown>))
}

export function createGroup(db: Database.Database, input: CreateGroupInput): Group {
  const id = uuid()
  const ts = now()
  const maxOrder = db.prepare(`SELECT MAX(sort_order) as m FROM groups`).get() as { m: number | null }
  const sortOrder = (maxOrder.m ?? -1) + 1

  db.prepare(`
    INSERT INTO groups (id, name, icon, accent_color, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, input.name, input.icon ?? '', input.accentColor ?? '#6366f1', sortOrder, ts, ts)

  return getAllGroups(db).find(g => g.id === id)!
}

export function updateGroup(db: Database.Database, input: UpdateGroupInput): Group | null {
  const ts = now()
  db.prepare(`
    UPDATE groups
    SET name = COALESCE(?, name),
        icon = COALESCE(?, icon),
        accent_color = COALESCE(?, accent_color),
        sort_order = COALESCE(?, sort_order),
        updated_at = ?
    WHERE id = ?
  `).run(
    input.name ?? null,
    input.icon ?? null,
    input.accentColor ?? null,
    input.sortOrder ?? null,
    ts,
    input.id
  )

  const row = db.prepare(`SELECT * FROM groups WHERE id = ?`).get(input.id)
  return row ? rowToGroup(row as Record<string, unknown>) : null
}

export function deleteGroup(db: Database.Database, id: string): boolean {
  const result = db.prepare(`DELETE FROM groups WHERE id = ?`).run(id)
  return result.changes > 0
}

/** Returns card counts for every group that has at least one card.
 *  Groups absent from the result have 0 cards — caller treats missing = 0. */
export function getGroupCardCounts(
  db: Database.Database
): { groupId: string; cardCount: number }[] {
  const rows = db.prepare(`
    SELECT group_id AS groupId, COUNT(*) AS cardCount
    FROM cards
    GROUP BY group_id
  `).all()
  return rows as { groupId: string; cardCount: number }[]
}

// Reorder: update sort_order for each id based on its array position
export function reorderGroups(db: Database.Database, ids: string[]): boolean {
  const stmt = db.prepare(`UPDATE groups SET sort_order = ?, updated_at = ? WHERE id = ?`)
  const ts = now()
  db.transaction(() => {
    ids.forEach((id, index) => stmt.run(index, ts, id))
  })()
  return true
}
