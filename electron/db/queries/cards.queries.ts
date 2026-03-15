import type Database from 'better-sqlite3'
import type { Card, CreateCardInput, UpdateCardInput } from '../../types'
import { v4 as uuid } from 'uuid'

function now(): string {
  return new Date().toISOString()
}

function rowToCard(row: Record<string, unknown>): Card {
  return {
    id:        row.id as string,
    groupId:   row.group_id as string,
    name:      row.name as string,
    icon:      row.icon as string,
    sortOrder: row.sort_order as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

export function getCardsByGroup(db: Database.Database, groupId: string): Card[] {
  const rows = db.prepare(`SELECT * FROM cards WHERE group_id = ? ORDER BY sort_order ASC`).all(groupId)
  return rows.map(r => rowToCard(r as Record<string, unknown>))
}

export function createCard(db: Database.Database, input: CreateCardInput): Card {
  const id = uuid()
  const ts = now()
  const maxOrder = db.prepare(
    `SELECT MAX(sort_order) as m FROM cards WHERE group_id = ?`
  ).get(input.groupId) as { m: number | null }
  const sortOrder = (maxOrder.m ?? -1) + 1

  db.prepare(`
    INSERT INTO cards (id, group_id, name, icon, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, input.groupId, input.name, input.icon ?? '', sortOrder, ts, ts)

  return getCardsByGroup(db, input.groupId).find(c => c.id === id)!
}

export function updateCard(db: Database.Database, input: UpdateCardInput): Card | null {
  const ts = now()
  db.prepare(`
    UPDATE cards
    SET name = COALESCE(?, name),
        icon = COALESCE(?, icon),
        sort_order = COALESCE(?, sort_order),
        updated_at = ?
    WHERE id = ?
  `).run(input.name ?? null, input.icon ?? null, input.sortOrder ?? null, ts, input.id)

  const row = db.prepare(`SELECT * FROM cards WHERE id = ?`).get(input.id)
  return row ? rowToCard(row as Record<string, unknown>) : null
}

export function deleteCard(db: Database.Database, id: string): boolean {
  const result = db.prepare(`DELETE FROM cards WHERE id = ?`).run(id)
  return result.changes > 0
}

/** Moves a card to a different group. Assigns it the next available sort_order in the target group. */
export function moveCard(db: Database.Database, cardId: string, targetGroupId: string): Card | null {
  const ts = now()
  const maxOrder = db.prepare(
    `SELECT MAX(sort_order) as m FROM cards WHERE group_id = ?`
  ).get(targetGroupId) as { m: number | null }
  const sortOrder = (maxOrder.m ?? -1) + 1

  db.prepare(`
    UPDATE cards
    SET group_id = ?, sort_order = ?, updated_at = ?
    WHERE id = ?
  `).run(targetGroupId, sortOrder, ts, cardId)

  const row = db.prepare(`SELECT * FROM cards WHERE id = ?`).get(cardId)
  return row ? rowToCard(row as Record<string, unknown>) : null
}

export function reorderCards(db: Database.Database, ids: string[]): boolean {
  const stmt = db.prepare(`UPDATE cards SET sort_order = ?, updated_at = ? WHERE id = ?`)
  const ts = now()
  db.transaction(() => {
    ids.forEach((id, index) => stmt.run(index, ts, id))
  })()
  return true
}
