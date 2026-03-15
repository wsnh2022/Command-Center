/**
 * backup.service.ts
 * Auto-backup and snapshot management for Command-Center.
 *
 * autoBackup()      — called after every DB write, copies DB to /backups/, trims to 10
 * listSnapshots()   — returns sorted snapshot list (newest first)
 * restoreSnapshot() — validates + replaces DB with a named snapshot
 *
 * All functions are synchronous and non-fatal — wrapped in try/catch at call sites.
 * Backup filenames: backup-{ISO-timestamp}.db  e.g. backup-2026-03-14T16-30-00-000Z.db
 */

import { copyFileSync, readdirSync, unlinkSync, statSync, existsSync } from 'fs'
import { join } from 'path'
import { Paths } from '../utils/paths'
import { getDb, closeDb } from '../db/database'
import { runMigrations } from '../db/migrations/001_initial'
import { migration002 } from '../db/migrations/002_item_type_refactor'
import { migration003 } from '../db/migrations/003_icon_color'

// Filename pattern — validated before any file operation
const BACKUP_REGEX = /^backup-[\dT\-:.Z]+\.db$/

/** Max number of snapshots to keep — oldest are deleted beyond this limit */
const MAX_SNAPSHOTS = 10

/** Generate a safe filename-compatible ISO timestamp */
function makeTimestamp(): string {
  return new Date().toISOString().replace(/:/g, '-')
}

/**
 * Copy current DB to /backups/backup-{timestamp}.db.
 * Trims oldest snapshots if count exceeds MAX_SNAPSHOTS.
 * Silent — never throws.
 */
export function autoBackup(): void {
  try {
    // Checkpoint WAL before copying — ensures the DB file on disk is up to date
    try { getDb().pragma('wal_checkpoint(FULL)') } catch { /* ignore if DB not open */ }

    const filename = `backup-${makeTimestamp()}.db`
    const dest = join(Paths.backups, filename)
    copyFileSync(Paths.db, dest)

    // Trim: list all valid backups sorted oldest first, delete beyond MAX_SNAPSHOTS
    const all = getBackupFiles()
    if (all.length > MAX_SNAPSHOTS) {
      const toDelete = all.slice(0, all.length - MAX_SNAPSHOTS)  // oldest first after sort
      for (const f of toDelete) {
        try { unlinkSync(join(Paths.backups, f)) } catch { /* ignore delete failure */ }
      }
    }
  } catch { /* non-fatal — never block a DB write because backup failed */ }
}

/** Returns valid backup filenames sorted oldest first (ascending by filename = ascending by time) */
function getBackupFiles(): string[] {
  try {
    return readdirSync(Paths.backups)
      .filter(f => BACKUP_REGEX.test(f))
      .sort()  // ISO timestamps sort lexicographically = chronologically
  } catch {
    return []
  }
}

export interface SnapshotInfo {
  filename:  string
  timestamp: string   // human-readable ISO string derived from filename
  sizeBytes: number
}

/**
 * Returns snapshot list sorted newest first — used by ImportExportPage.
 */
export function listSnapshots(): SnapshotInfo[] {
  return getBackupFiles()
    .reverse()  // newest first for UI display
    .map(filename => {
      const tsRaw = filename
        .replace('backup-', '')
        .replace('.db', '')
        .replace(/-(\d{2})-(\d{2})-(\d{3}Z)$/, ':$1:$2.$3')  // restore colons in time portion
      let sizeBytes = 0
      try { sizeBytes = statSync(join(Paths.backups, filename)).size } catch { /* ignore */ }
      return { filename, timestamp: tsRaw, sizeBytes }
    })
}

/**
 * Replaces current DB with a named snapshot.
 * - Validates filename matches BACKUP_REGEX (no path traversal)
 * - Auto-backs-up current state first
 * - Closes DB, copies snapshot over Paths.db, re-opens DB + runs all migrations
 * Throws on invalid filename or missing file.
 */
export function restoreSnapshot(filename: string): void {
  if (!BACKUP_REGEX.test(filename)) throw new Error('Invalid snapshot filename')
  const src = join(Paths.backups, filename)

  // Validate file exists before touching the live DB
  statSync(src)  // throws if missing

  // Auto-backup current state so restore is reversible
  autoBackup()

  // Close DB before replacing the file — required on Windows (file lock)
  closeDb()

  try {
    copyFileSync(src, Paths.db)

    // Delete WAL and SHM sidecar files — same reason as importFromZip
    for (const ext of ['-wal', '-shm']) {
      const sidecar = Paths.db + ext
      if (existsSync(sidecar)) {
        try { unlinkSync(sidecar) } catch { /* ignore */ }
      }
    }
  } finally {
    // Always re-open DB — even if copy failed, app must stay functional
    const db = getDb()
    runMigrations(db)
    migration002(db)
    migration003(db)
  }
}
