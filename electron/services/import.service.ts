/**
 * import.service.ts
 * Restores Command-Center data from a ZIP export file.
 *
 * ZIP must contain 'command-center.db' — validated before replacing live DB.
 * Assets (assets/icons/, assets/favicons/) directories are wiped clean then
 * re-populated from the ZIP — full replace, not merge.
 *
 * Safety: auto-backs-up current state before any destructive operation.
 * DB is closed before file replacement (Windows file lock requirement)
 * and re-opened + migrated after extraction.
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, unlinkSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { createRequire } from 'module'
import { Paths } from '../utils/paths'

import { getDb, closeDb } from '../db/database'
import { autoBackup } from './backup.service'

// JSZip is a CJS module — use createRequire to avoid ESM default-import interop issues
const require = createRequire(import.meta.url)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const JSZip = require('jszip') as { loadAsync: (data: Buffer) => Promise<any> }

/**
 * Import data from a ZIP file at zipPath.
 * Replaces current DB and merges assets.
 * Throws if ZIP is invalid or doesn't contain command-center.db.
 */
export async function importFromZip(zipPath: string): Promise<void> {
  // Load and parse the ZIP
  const zipBuffer = readFileSync(zipPath)
  const zip = await JSZip.loadAsync(zipBuffer)

  // Validate: ZIP must contain command-center.db
  const dbEntry = zip.file('command-center.db')
  if (!dbEntry) throw new Error('Invalid export file: missing command-center.db')

  // Extract DB bytes before closing the live connection
  const dbBuffer = await dbEntry.async('nodebuffer')

  // Auto-backup current state — makes this operation reversible
  autoBackup()

  // Close DB before replacing the file (Windows locks the file while open)
  closeDb()

  try {
    // Replace live DB with imported one
    writeFileSync(Paths.db, dbBuffer)

    // Delete WAL and SHM sidecar files — SQLite in WAL mode creates these
    // alongside the DB file. If they exist from the old session they would
    // be replayed on top of the newly imported DB, undoing the import.
    for (const ext of ['-wal', '-shm']) {
      const sidecar = Paths.db + ext
      if (existsSync(sidecar)) {
        try { unlinkSync(sidecar) } catch { /* ignore — not fatal */ }
      }
    }

    // Clean icon directories before extracting imported assets.
    //
    // Previously this merged over the existing directories, which left two problems:
    //   1. Orphan files — icons from the old DB that don't exist in the imported DB
    //      stay on disk and waste space / cause confusion.
    //   2. Stale local files win — if the imported ZIP references a path that already
    //      exists locally, writeFileSync overwrites it correctly, BUT if local files
    //      exist that conflict with what the imported DB expects, there's no clean state.
    //
    // Fix: wipe iconsDir and faviconsDir before extraction so the imported ZIP is the
    // sole source of truth. mkdirSync re-creates the empty directories immediately.
    for (const dir of [Paths.iconsDir, Paths.faviconsDir]) {
      if (existsSync(dir)) {
        for (const entry of readdirSync(dir)) {
          try { rmSync(join(dir, entry), { recursive: true, force: true }) } catch { /* skip */ }
        }
      }
      mkdirSync(dir, { recursive: true })
    }

    // Extract asset files from ZIP — now writing into clean, empty directories
    const assetFiles = Object.keys(zip.files).filter(
      p => p.startsWith('assets/') && !zip.files[p].dir
    )

    for (const zipPath of assetFiles) {
      const entry = zip.file(zipPath)
      if (!entry) continue
      const buf = await entry.async('nodebuffer')
      const destPath = join(Paths.userData, zipPath)
      // Ensure parent directory exists before writing
      mkdirSync(dirname(destPath), { recursive: true })
      writeFileSync(destPath, buf)
    }
  } finally {
    // Re-open DB — getDb() runs all migrations internally (001 → 002 → 003).
    // Do NOT call runMigrations / migration002 / migration003 here — that would
    // double-run them, wasting cycles and creating misleading log noise.
    getDb()
  }
}
