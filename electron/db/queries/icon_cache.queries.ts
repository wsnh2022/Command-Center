import type Database from 'better-sqlite3'
import { v4 as uuid } from 'uuid'

function now(): string {
  return new Date().toISOString()
}

export interface IconCacheRow {
  id:        string
  domain:    string
  localPath: string
  fetchedAt: string
  isValid:   number  // 1 = valid, 0 = known-broken
}

function rowToCache(row: Record<string, unknown>): IconCacheRow {
  return {
    id:        row.id as string,
    domain:    row.domain as string,
    localPath: row.local_path as string,
    fetchedAt: row.fetched_at as string,
    isValid:   row.is_valid as number,
  }
}

/** Lookup cached favicon entry by domain. Returns null if not found. */
export function getIconCache(
  db: Database.Database,
  domain: string,
): IconCacheRow | null {
  const row = db.prepare(
    `SELECT * FROM icon_cache WHERE domain = ?`
  ).get(domain)
  return row ? rowToCache(row as Record<string, unknown>) : null
}

/** Insert or update a favicon cache entry. */
export function upsertIconCache(
  db: Database.Database,
  domain: string,
  localPath: string,
  isValid: 0 | 1,
): void {
  db.prepare(`
    INSERT INTO icon_cache (id, domain, local_path, fetched_at, is_valid)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(domain) DO UPDATE SET
      local_path = excluded.local_path,
      fetched_at = excluded.fetched_at,
      is_valid   = excluded.is_valid
  `).run(uuid(), domain, localPath, now(), isValid)
}

/** Mark a domain's favicon as invalid - prevents re-fetching known-broken entries. */
export function markIconCacheInvalid(
  db: Database.Database,
  domain: string,
): void {
  db.prepare(
    `UPDATE icon_cache SET is_valid = 0, fetched_at = ? WHERE domain = ?`
  ).run(now(), domain)
}

/** Remove all cache entries (used during import/reset). */
export function clearIconCache(db: Database.Database): void {
  db.prepare(`DELETE FROM icon_cache`).run()
}
