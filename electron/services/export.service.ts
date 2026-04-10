/**
 * export.service.ts
 * Produces a portable ZIP archive of all Command-Center data.
 *
 * ZIP contents:
 *   command-center.db    - full SQLite database
 *   assets/icons/        - custom uploaded icons
 *   assets/favicons/     - cached favicons
 *
 * All asset paths in the DB are relative - they work correctly
 * on any machine after import.
 */

import { existsSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'fs'
import { join, relative } from 'path'
import { createRequire } from 'module'
import { Paths } from '../utils/paths'
import { getDb } from '../db/database'

// JSZip is a CJS module - use createRequire to avoid ESM default-import interop issues
// when externalizeDepsPlugin externalizes it in the main process bundle.
const require = createRequire(import.meta.url)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const JSZip = require('jszip') as new () => any

/**
 * Recursively add all files under a directory to a JSZip instance.
 * Paths inside the ZIP are relative to Paths.userData so they match
 * the DB's stored relative paths exactly.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function addDirToZip(zip: any, dirPath: string): void {
  let entries: string[]
  try {
    entries = readdirSync(dirPath)
  } catch {
    return  // directory doesn't exist yet - skip silently
  }

  for (const entry of entries) {
    const fullPath = join(dirPath, entry)
    let stat
    try { stat = statSync(fullPath) } catch { continue }

    if (stat.isDirectory()) {
      addDirToZip(zip, fullPath)
    } else {
      // ZIP path: relative to userData so it mirrors the DB's asset paths
      const zipPath = relative(Paths.userData, fullPath).replace(/\\/g, '/')
      try {
        zip.file(zipPath, readFileSync(fullPath))
      } catch { /* skip unreadable files */ }
    }
  }
}

/**
 * Export all data to a ZIP file at destPath.
 * Writes: command-center.db + assets/ tree.
 */
export async function exportToZip(destPath: string): Promise<void> {
  const zip = new JSZip()

  // Use VACUUM INTO to produce a clean, fully-committed DB snapshot.
  //
  // Why not wal_checkpoint(FULL) + readFileSync?
  //   FULL checkpoint is best-effort - it returns immediately if any reader
  //   is active. Electron's renderer almost always has an active reader via
  //   IPC, so FULL frequently exits without flushing. The exported ZIP then
  //   contains stale data (deleted rows still present, recent writes missing).
  //
  // VACUUM INTO reads directly from the live in-memory database state and
  // writes a fully checkpointed, WAL-free copy to a temp path. It works
  // correctly even with active readers and always reflects current committed
  // state. The temp file is added to the ZIP and then deleted.
  const tempDbPath = join(Paths.userData, '_export_temp.db')
  try {
    // Clean up any leftover temp file from a previous failed export
    if (existsSync(tempDbPath)) unlinkSync(tempDbPath)

    // Forward-slash path required by SQLite on all platforms (including Windows)
    getDb().exec(`VACUUM INTO '${tempDbPath.replace(/\\/g, '/')}'`)

    zip.file('command-center.db', readFileSync(tempDbPath))
  } finally {
    // Always remove the temp file, whether the ZIP step succeeded or not
    if (existsSync(tempDbPath)) unlinkSync(tempDbPath)
  }

  // Add all asset files (icons + favicons)
  addDirToZip(zip, Paths.assetsDir)

  // Generate ZIP buffer and write to destination
  const buffer = await zip.generateAsync({
    type:               'nodebuffer',
    compression:        'DEFLATE',
    compressionOptions: { level: 6 },
  })

  writeFileSync(destPath, buffer)
}
