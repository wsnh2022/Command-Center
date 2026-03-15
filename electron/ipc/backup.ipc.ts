/**
 * backup.ipc.ts
 * IPC handlers for backup, restore, export, and import.
 *
 * Channels registered:
 *   backup:listSnapshots    — returns SnapshotInfo[] sorted newest first
 *   backup:restoreSnapshot  — restores DB from a named snapshot file
 *   backup:export           — exports ZIP to a user-chosen path
 *   backup:import           — imports ZIP from a user-chosen path
 *
 * Push events (main → renderer):
 *   backup:importComplete   — emitted after a successful import so renderer reloads data
 */

import { ipcMain, BrowserWindow } from 'electron'
import { sanitizeString } from '../utils/sanitize'
import { listSnapshots, restoreSnapshot } from '../services/backup.service'
import { exportToZip } from '../services/export.service'
import { importFromZip } from '../services/import.service'

export function registerBackupHandlers(): void {

  // ── backup:listSnapshots ──────────────────────────────────────────────────
  // Returns all available snapshots sorted newest first.
  ipcMain.handle('backup:listSnapshots', () => {
    return listSnapshots()
  })

  // ── backup:restoreSnapshot ────────────────────────────────────────────────
  // Validates filename, auto-backs-up current state, replaces DB.
  ipcMain.handle('backup:restoreSnapshot', (_e, input) => {
    const filename = sanitizeString(input?.filename, 100)
    if (!filename) throw new Error('Snapshot filename is required')
    restoreSnapshot(filename)
    return { success: true }
  })

  // ── backup:export ─────────────────────────────────────────────────────────
  // Exports ZIP to the path returned by system:showSaveDialog.
  ipcMain.handle('backup:export', async (_e, input) => {
    const destPath = sanitizeString(input?.destPath, 2048)
    if (!destPath) throw new Error('Export destination path is required')
    await exportToZip(destPath)
    return { success: true }
  })

  // ── backup:import ─────────────────────────────────────────────────────────
  // Imports ZIP from the path returned by system:showOpenDialog.
  // Emits backup:importComplete push event so renderer reloads all data.
  ipcMain.handle('backup:import', async (event, input) => {
    const zipPath = sanitizeString(input?.zipPath, 2048)
    if (!zipPath) throw new Error('Import ZIP path is required')
    await importFromZip(zipPath)

    // Push event to renderer — all hooks need to refetch after DB replacement
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.webContents.send('backup:importComplete')

    return { success: true }
  })
}
