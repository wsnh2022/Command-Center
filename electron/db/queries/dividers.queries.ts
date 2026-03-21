import type Database from 'better-sqlite3'
import type { Divider, CreateDividerInput, UpdateDividerInput } from '../../types'
import { v4 as uuid } from 'uuid'

function now(): string {
  return new Date().toISOString()
}

function rowToDivider(row: Record<string, unknown>): Divider {
  return {
    id:           row.id          as string,
    label:        row.label       as string,
    afterGroupId: row.after_group_id as string,
    sortOrder:    row.sort_order  as number,
    createdAt:    row.created_at  as string,
    updatedAt:    row.updated_at  as string,
  }
}

export function getAllDividers(db: Database.Database): Divider[] {
  const rows = db.prepare(`SELECT * FROM dividers ORDER BY sort_order ASC`).all()
  return rows.map(r => rowToDivider(r as Record<string, unknown>))
}

export function createDivider(db: Database.Database, input: CreateDividerInput): Divider {
  const id = uuid()
  const ts = now()
  // Place new divider after all existing dividers for this group
  const maxOrder = db.prepare(
    `SELECT MAX(sort_order) as m FROM dividers WHERE after_group_id = ?`
  ).get(input.afterGroupId) as { m: number | null }
  const sortOrder = (maxOrder.m ?? -1) + 1

  db.prepare(`
    INSERT INTO dividers (id, label, after_group_id, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, input.label, input.afterGroupId, sortOrder, ts, ts)

  return rowToDivider(
    db.prepare(`SELECT * FROM dividers WHERE id = ?`).get(id) as Record<string, unknown>
  )
}

export function updateDivider(db: Database.Database, input: UpdateDividerInput): Divider | null {
  const ts = now()
  db.prepare(`
    UPDATE dividers
    SET label          = COALESCE(?, label),
        after_group_id = COALESCE(?, after_group_id),
        sort_order     = COALESCE(?, sort_order),
        updated_at     = ?
    WHERE id = ?
  `).run(
    input.label        ?? null,
    input.afterGroupId ?? null,
    input.sortOrder    ?? null,
    ts,
    input.id
  )

  const row = db.prepare(`SELECT * FROM dividers WHERE id = ?`).get(input.id)
  return row ? rowToDivider(row as Record<string, unknown>) : null
}

export function deleteDivider(db: Database.Database, id: string): boolean {
  const result = db.prepare(`DELETE FROM dividers WHERE id = ?`).run(id)
  return result.changes > 0
}

/** Batch-update afterGroupId + sortOrder for all dividers in one transaction.
 *  Called after every drag reorder so positions reflect the new flat list. */
export function reorderDividers(
  db: Database.Database,
  updates: { id: string; afterGroupId: string; sortOrder: number }[]
): boolean {
  const stmt = db.prepare(`
    UPDATE dividers
    SET after_group_id = ?, sort_order = ?, updated_at = ?
    WHERE id = ?
  `)
  const ts = now()
  db.transaction(() => {
    for (const u of updates) {
      stmt.run(u.afterGroupId, u.sortOrder, ts, u.id)
    }
  })()
  return true
}
