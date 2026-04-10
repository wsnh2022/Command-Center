/**
 * icon.service.ts
 * Save-time icon normalization pipeline.
 * All icons resolve to local files - no network access at runtime.
 *
 * Rules (from ICON_SYSTEM.md):
 *  - Emoji / library icons: stored as text in DB, no file I/O here
 *  - Upload:  copy source file into assets/icons/{uuid}.{ext}
 *  - URL:     download once, save to assets/icons/{uuid}.{ext}
 *  - Base64:  decode, detect format, save to assets/icons/{uuid}.{ext}
 *  - Favicon: fetch from Google Favicons API, save to assets/favicons/{hash}.png
 *             validate response is a real image (>500 bytes), else mark invalid
 *
 * Image processing: no external libs - copy/save buffers as-is.
 * Supported: .png .svg .jpg .jpeg .ico  (all render natively in <img>)
 */

import { existsSync, copyFileSync, writeFileSync, readFileSync } from 'fs'
import { join, extname } from 'path'
import { createHash } from 'crypto'
import { v4 as uuid } from 'uuid'
import { net, app } from 'electron'   // Chromium network stack - required for HTTPS in main process
import { Paths } from '../utils/paths'
import { getDb } from '../db/database'
import {
  getIconCache,
  upsertIconCache,
  markIconCacheInvalid,
} from '../db/queries/icon_cache.queries'
import type { ItemType } from '../../src/types'

// ─── Constants ───────────────────────────────────────────────────────────────

const ALLOWED_EXTENSIONS = ['.png', '.svg', '.jpg', '.jpeg', '.ico']

// ─── Generic type fallback ────────────────────────────────────────────────────

// Returns the Lucide icon name for each item type - used as final fallback.
// Matches ItemTypeIcon in ItemIcons.tsx so the renderer can render consistently.
const TYPE_TO_LUCIDE: Record<ItemType, string> = {
  url: 'Globe',
  software: 'Zap',
  folder: 'Folder',
  command: 'Terminal',
}

export function getGenericIconName(type: ItemType): string {
  return TYPE_TO_LUCIDE[type] ?? 'LayoutGrid'
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Hash a domain string → 8-char hex prefix for favicon filenames */
function hashDomain(domain: string): string {
  return createHash('sha256').update(domain).digest('hex').slice(0, 16)
}

/** Detect image format from magic bytes. Returns extension including dot. */
function detectExtension(buffer: Buffer): string {
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return '.png'
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return '.jpg'
  if (buffer.slice(0, 4).toString() === '<svg' ||
    buffer.slice(0, 5).toString() === '<?xml') return '.svg'
  if (buffer[0] === 0x00 && buffer[1] === 0x00 &&
    buffer[2] === 0x01 && buffer[3] === 0x00) return '.ico'
  // GIF
  if (buffer.slice(0, 3).toString() === 'GIF') return '.gif'
  return '.png' // safe fallback
}

/** Fetch a remote URL via Electron net module - routes through Chromium stack, handles proxies + SSL. */
async function fetchBuffer(url: string): Promise<Buffer> {
  const response = await net.fetch(url)  // net.fetch, NOT global fetch - global fails silently in main process
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }
  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

// ─── Input method 1: Upload (local file) ─────────────────────────────────────

/**
 * Copy a user-selected local file into assets/icons/.
 * Returns the relative path stored in DB (e.g. "assets/icons/abc123.png").
 */
export function saveUploadedIcon(sourcePath: string): string {
  const ext = extname(sourcePath).toLowerCase()
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new Error(`Unsupported icon format: ${ext}. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`)
  }
  const filename = `${uuid()}${ext}`
  const destAbsPath = join(Paths.iconsDir, filename)
  copyFileSync(sourcePath, destAbsPath)
  return `assets/icons/${filename}`
}

// ─── Input method 2: Remote URL (download once at save time) ─────────────────

/**
 * Download a remote image URL, detect its format, save locally.
 * Returns relative path.
 */
export async function saveIconFromUrl(imageUrl: string): Promise<string> {
  const buffer = await fetchBuffer(imageUrl)
  if (buffer.length < 64) throw new Error('Downloaded file is too small to be a valid image')
  const ext = detectExtension(buffer)
  const filename = `${uuid()}${ext}`
  const destPath = join(Paths.iconsDir, filename)
  writeFileSync(destPath, buffer)
  return `assets/icons/${filename}`
}

// ─── Input method 3: Base64 ───────────────────────────────────────────────────

/**
 * Decode a base64 string (with or without data URI prefix), detect format, save.
 * Returns relative path.
 */
export function saveBase64Icon(base64: string): string {
  // Strip optional data URI prefix: "data:image/png;base64,..."
  const raw = base64.replace(/^data:image\/[^;]+;base64,/, '').trim()
  const buffer = Buffer.from(raw, 'base64')
  if (buffer.length < 64) throw new Error('Base64 data is too small to be a valid image')
  const ext = detectExtension(buffer)
  const filename = `${uuid()}${ext}`
  const destPath = join(Paths.iconsDir, filename)
  writeFileSync(destPath, buffer)
  return `assets/icons/${filename}`
}

// ─── Input method 4: Favicon (auto, triggered on URL item save) ──────────────

/**
 * Fetch and cache a favicon for a URL item.
 * Uses Google Favicons API. Validates response is a real image (>500 bytes).
 * Non-blocking: caller should fire-and-forget; renderer falls back to type icon.
 * Returns relative path on success, empty string on failure.
 */
export async function fetchAndCacheFavicon(itemUrl: string, forceRefetch = false): Promise<string> {
  let domain: string
  try {
    domain = new URL(itemUrl).hostname
  } catch {
    return ''
  }

  const db = getDb()

  if (forceRefetch) {
    try { db.prepare(`DELETE FROM icon_cache WHERE domain = ?`).run(domain) } catch { /* ignore */ }
  }

  const cached = getIconCache(db, domain)
  if (cached && cached.isValid === 1 && existsSync(join(Paths.userData, cached.localPath))) {
    return cached.localPath
  }

  if (cached && cached.isValid === 0) {
    const ageMs = Date.now() - new Date(cached.fetchedAt).getTime()
    if (ageMs < 24 * 60 * 60 * 1000) {
      return ''
    }
  }

  try {
    let buffer: Buffer | null = null

    // Strategy 1: Vemetric
    try {
      const vemetricUrl = `https://favicon.vemetric.com/${itemUrl}?size=64&format=png`
      const vBuffer = await fetchBuffer(vemetricUrl)
      if (vBuffer.length > 200) buffer = vBuffer
    } catch { /* strategy failed - try next */ }

    // Strategy 2: favicon.im
    if (!buffer) {
      try {
        const faviconImUrl = `https://favicon.im/${encodeURIComponent(domain)}?larger=true`
        const imBuffer = await fetchBuffer(faviconImUrl)
        if (imBuffer.length > 200) buffer = imBuffer
      } catch { /* strategy failed - try next */ }
    }

    // Strategy 3: DuckDuckGo
    if (!buffer) {
      try {
        const ddgUrl = `https://icons.duckduckgo.com/ip3/${encodeURIComponent(domain)}.ico`
        buffer = await fetchBuffer(ddgUrl)
      } catch { /* strategy failed - all exhausted */ }
    }

    if (!buffer) {
      markIconCacheInvalid(db, domain)
      return ''
    }

    const ext = detectExtension(buffer)
    const filename = `${hashDomain(domain)}${ext}`
    const localPath = `assets/favicons/${filename}`
    const absPath = join(Paths.faviconsDir, filename)
    writeFileSync(absPath, buffer)
    upsertIconCache(db, domain, localPath, 1)
    return localPath
  } catch {
    return ''
  }
}

// ─── Runtime resolution ───────────────────────────────────────────────────────

export interface ResolveResult {
  resolvedPath: string   // relative path (icons:resolve returns this)
  source: 'local' | 'refetched' | 'generic'
}

/**
 * Resolve an icon path to a verified-local path.
 * Called by icons:resolve IPC handler on every icon render.
 *
 * Priority chain (per ICON_SYSTEM.md §3):
 *  1. emoji / library - no file needed, return as-is
 *  2. local file exists → return as-is
 *  3. favicon source + file missing → re-fetch async, return generic meanwhile
 *  4. custom source + file missing → return generic (file is gone)
 */
export async function resolveIcon(
  iconPath: string,
  iconSource: string,
  itemType: ItemType,
  itemUrl?: string,
): Promise<ResolveResult> {
  // emoji / library: renderer handles these directly, no file path needed
  if (iconSource === 'emoji' || iconSource === 'library') {
    return { resolvedPath: iconPath, source: 'local' }
  }

  // Empty or invalid path - for URL items, attempt favicon fetch first
  const isUrlType = itemType === 'url' && itemUrl
  const isAutoOrFavicon = iconSource === 'favicon' || iconSource === 'auto'

  const absPath = iconPath ? join(Paths.userData, iconPath) : null
  const fileExists = absPath && existsSync(absPath)

  if (isUrlType && isAutoOrFavicon && !fileExists) {
    const fetched = await fetchAndCacheFavicon(itemUrl)
    if (fetched) return { resolvedPath: fetched, source: 'refetched' }
  }

  // File exists → serve it
  if (fileExists && iconPath) {
    return { resolvedPath: iconPath, source: 'local' }
  }

  // Custom / auto / unreachable favicon → generic fallback
  return { resolvedPath: getGenericIconName(itemType), source: 'generic' }
}

// ─── Input method 5: File icon (extract from any file via OS shell) ──────────

/**
 * Extract the shell icon for any file path using Electron's app.getFileIcon().
 * Works for .exe, .lnk, .pdf, .ahk, .bat, .py - any file Windows has an icon for.
 * Uses the OS shell association engine (same source as File Explorer / taskbar).
 * Saves the result as PNG to assets/icons/{uuid}.png.
 * Returns relative path on success, empty string on failure.
 */
export async function extractFileIcon(filePath: string): Promise<string> {
  if (!filePath || !existsSync(filePath)) return ''
  try {
    const nativeImg = await app.getFileIcon(filePath, { size: 'large' })
    if (nativeImg.isEmpty()) return ''
    const buffer = nativeImg.toPNG()
    if (buffer.length < 64) return ''
    const filename = `${uuid()}.png`
    const destPath = join(Paths.iconsDir, filename)
    writeFileSync(destPath, buffer)
    return `assets/icons/${filename}`
  } catch {
    return ''
  }
}

// ─── Validation helper for IconPicker URL preview ────────────────────────────

/**
 * Download a remote image to memory only (no disk write).
 * Used by the IconPicker URL tab for live preview before confirming.
 * Returns base64 data URI for renderer preview, or throws on failure.
 */
export async function previewIconFromUrl(imageUrl: string): Promise<string> {
  const buffer = await fetchBuffer(imageUrl)
  if (buffer.length < 64) throw new Error('Response too small to be a valid image')
  const ext = detectExtension(buffer)
  const mimeMap: Record<string, string> = {
    '.png': 'image/png', '.svg': 'image/svg+xml',
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon',
  }
  const mime = mimeMap[ext] ?? 'image/png'
  return `data:${mime};base64,${buffer.toString('base64')}`
}

/** Read a local file to a base64 data URI - used for upload preview in IconPicker. */
export function previewLocalFile(filePath: string): string {
  const ext = extname(filePath).toLowerCase()
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new Error(`Unsupported format: ${ext}`)
  }
  const buffer = readFileSync(filePath)
  const mimeMap: Record<string, string> = {
    '.png': 'image/png', '.svg': 'image/svg+xml',
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon',
  }
  const mime = mimeMap[ext] ?? 'image/png'
  return `data:${mime};base64,${buffer.toString('base64')}`
}
