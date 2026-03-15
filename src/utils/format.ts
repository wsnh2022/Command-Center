/**
 * format.ts
 * Shared formatting utilities — used across the app (Phase 9+).
 * Stubs created in Phase 9; expanded in Phase 13 for AboutPage.
 */

/**
 * Format a byte count into a human-readable string.
 * e.g. 1024 → "1.0 KB", 1_048_576 → "1.0 MB"
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`
}

/**
 * Format an ISO date string to a locale date string.
 * e.g. "2026-03-14T10:00:00Z" → "Mar 14, 2026"
 */
export function formatDate(iso: string): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    })
  } catch {
    return iso
  }
}
