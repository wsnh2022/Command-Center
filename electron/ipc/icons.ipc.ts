/**
 * icons.ipc.ts
 * IPC handlers for the icon system.
 *
 * Channels registered:
 *   icons:resolve       — resolve iconPath to verified local path (render-time)
 *   icons:saveUpload    — copy local file into assets/icons/
 *   icons:saveUrl       — download remote image into assets/icons/
 *   icons:saveBase64    — decode base64 into assets/icons/
 *   icons:previewUrl    — fetch remote image to memory, return base64 (no disk write)
 *   icons:previewLocal  — read local file, return base64 (no disk write)
 *   icons:fetchFavicon      — trigger favicon fetch for a URL item (fire-and-forget wrapper)
 *   icons:extractFileIcon   — extract shell icon from any file (.exe/.lnk/.pdf/etc) via OS
 */

import { ipcMain } from 'electron'
import { sanitizePath, sanitizeUrl, sanitizeString, sanitizeItemType } from '../utils/sanitize'
import {
  resolveIcon,
  saveUploadedIcon,
  saveIconFromUrl,
  saveBase64Icon,
  fetchAndCacheFavicon,
  previewIconFromUrl,
  previewLocalFile,
  extractFileIcon,
} from '../services/icon.service'
import type { ItemType } from '../../src/types'

export function registerIconHandlers(): void {

  // ── icons:resolve ──────────────────────────────────────────────────────────
  // Called by useResolvedIcon hook on every item render.
  // Returns { resolvedPath, source } — renderer uses resolvedPath for <img src>.
  ipcMain.handle('icons:resolve', async (_e, raw: unknown) => {
    const payload   = raw as Record<string, unknown>
    const iconPath  = sanitizePath(payload.iconPath)
    const iconSource = sanitizeString(payload.iconSource, 20)
    const itemType  = sanitizeItemType(payload.itemType) as ItemType || 'url'
    const itemUrl   = sanitizeUrl(payload.itemUrl)
    return resolveIcon(iconPath, iconSource, itemType, itemUrl || undefined)
  })

  // ── icons:saveUpload ───────────────────────────────────────────────────────
  // Copy a local file into assets/icons/. Returns { localPath }.
  ipcMain.handle('icons:saveUpload', async (_e, raw: unknown) => {
    const payload    = raw as Record<string, unknown>
    const sourcePath = sanitizePath(payload.sourcePath)
    if (!sourcePath) throw new Error('Invalid source path')
    const localPath = saveUploadedIcon(sourcePath)
    return { localPath }
  })

  // ── icons:saveUrl ──────────────────────────────────────────────────────────
  // Download remote image once, save locally. Returns { localPath }.
  ipcMain.handle('icons:saveUrl', async (_e, raw: unknown) => {
    const payload  = raw as Record<string, unknown>
    const imageUrl = sanitizeUrl(payload.imageUrl)
    if (!imageUrl) throw new Error('Invalid image URL')
    const localPath = await saveIconFromUrl(imageUrl)
    return { localPath }
  })

  // ── icons:saveBase64 ───────────────────────────────────────────────────────
  // Decode base64 string, save locally. Returns { localPath }.
  ipcMain.handle('icons:saveBase64', async (_e, raw: unknown) => {
    const payload = raw as Record<string, unknown>
    const b64     = sanitizeString(payload.base64 as string, 5_000_000) // up to ~3.5MB file
    if (!b64) throw new Error('Empty base64 data')
    const localPath = saveBase64Icon(b64)
    return { localPath }
  })

  // ── icons:previewUrl ───────────────────────────────────────────────────────
  // Fetch to memory only — returns base64 data URI for live preview in IconPicker.
  ipcMain.handle('icons:previewUrl', async (_e, raw: unknown) => {
    const payload  = raw as Record<string, unknown>
    const imageUrl = sanitizeUrl(payload.imageUrl)
    if (!imageUrl) throw new Error('Invalid image URL')
    const dataUri = await previewIconFromUrl(imageUrl)
    return { dataUri }
  })

  // ── icons:previewLocal ─────────────────────────────────────────────────────
  // Read local file to memory only — returns base64 data URI for upload preview.
  ipcMain.handle('icons:previewLocal', async (_e, raw: unknown) => {
    const payload    = raw as Record<string, unknown>
    const sourcePath = sanitizePath(payload.sourcePath)
    if (!sourcePath) throw new Error('Invalid source path')
    const dataUri = previewLocalFile(sourcePath)
    return { dataUri }
  })

  // ── icons:fetchFavicon ─────────────────────────────────────────────────────
  // Trigger favicon fetch for a URL item. Returns { localPath } or { localPath: '' }.
  // forceRefetch=true so any previously-invalid cache entry is wiped before retrying.
  ipcMain.handle('icons:fetchFavicon', async (_e, raw: unknown) => {
    const payload  = raw as Record<string, unknown>
    const itemUrl  = sanitizeUrl(payload.itemUrl)
    if (!itemUrl) return { localPath: '' }
    const localPath = await fetchAndCacheFavicon(itemUrl, true)
    return { localPath }
  })

  // ── icons:extractFileIcon ──────────────────────────────────────────────────
  // Extract the OS shell icon for any file path (.exe, .lnk, .pdf, .ahk, etc).
  // Uses Electron's app.getFileIcon() — same icon Windows Explorer shows.
  // Returns { localPath } on success, { localPath: '' } on failure.
  ipcMain.handle('icons:extractFileIcon', async (_e, raw: unknown) => {
    const payload  = raw as Record<string, unknown>
    const filePath = sanitizePath(payload.filePath)
    if (!filePath) return { localPath: '' }
    const localPath = await extractFileIcon(filePath)
    return { localPath }
  })
}
