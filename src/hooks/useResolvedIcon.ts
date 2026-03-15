/**
 * useResolvedIcon.ts
 * Resolves an item's iconPath to a verified local asset URL.
 *
 * Resolution logic (mirrors ICON_SYSTEM.md §3):
 *  - emoji / library → pass through immediately (renderer handles render)
 *  - local file      → return as command-center-asset:// URL
 *  - missing file    → main process attempts re-fetch (favicon) or returns generic name
 *
 * The hook NEVER blocks render — it returns a generic fallback synchronously
 * and updates to the real icon once the IPC call resolves.
 */

import { useState, useEffect, useRef } from 'react'
import { ipc } from '../utils/ipc'
import type { ItemType, IconSource } from '../types'

export interface ResolvedIcon {
  /** For emoji: the emoji char. For library: Lucide name. For file: command-center-asset:// URL. */
  value:  string
  /** How the icon should be rendered */
  kind:   'emoji' | 'library' | 'img' | 'generic'
}

// Converts a relative DB path to a command-center-asset:// URL the renderer can load
function toAssetUrl(relativePath: string): string {
  // relativePath e.g. "assets/icons/abc.png"
  return `command-center-asset://${relativePath}`
}

export function useResolvedIcon(
  iconPath:   string,
  iconSource: IconSource,
  itemType:   ItemType,
  itemUrl?:   string,
): ResolvedIcon {
  // Synchronous initial state — no flash, no loading spinner
  const initial = getInitialIcon(iconPath, iconSource, itemType)
  const [resolved, setResolved] = useState<ResolvedIcon>(initial)

  // Track previous inputs to avoid redundant IPC calls
  const prevKey = useRef('')

  useEffect(() => {
    const key = `${iconPath}|${iconSource}|${itemType}|${itemUrl ?? ''}`
    if (key === prevKey.current) return
    prevKey.current = key

    // emoji and library: no IPC needed — resolve synchronously and update state.
    // MUST call setResolved here, not just return early. useState(initial) only
    // runs on first mount — if the icon source changes (e.g. old icon was a favicon,
    // new one is a library icon), the stale state persists without this explicit update.
    if (iconSource === 'emoji' || iconSource === 'library') {
      setResolved(getInitialIcon(iconPath, iconSource, itemType))
      return
    }

    // File-based icons: ask main process to verify + resolve
    ipc.icons.resolve(iconPath, iconSource, itemType, itemUrl).then(({ resolvedPath, source }) => {
      if (source === 'generic') {
        setResolved({ value: resolvedPath, kind: 'generic' })
      } else {
        setResolved({ value: toAssetUrl(resolvedPath), kind: 'img' })
      }
    }).catch(() => {
      // IPC failure — fall back to generic silently
      setResolved({ value: itemType, kind: 'generic' })
    })
  }, [iconPath, iconSource, itemType, itemUrl])

  return resolved
}

// ─── Synchronous initial resolution (no IPC) ─────────────────────────────────
// Returns the best guess we can make without checking the filesystem.
// Prevents any loading flash — worst case we show a generic icon briefly.

function getInitialIcon(
  iconPath:   string,
  iconSource: IconSource,
  itemType:   ItemType,
): ResolvedIcon {
  if (iconSource === 'emoji') {
    return { value: iconPath || '📄', kind: 'emoji' }
  }
  if (iconSource === 'library') {
    return { value: iconPath || 'LayoutGrid', kind: 'library' }
  }
  if (iconPath) {
    // Optimistically assume file exists — IPC will correct if not
    return { value: toAssetUrl(iconPath), kind: 'img' }
  }
  // No icon set at all — generic type icon
  return { value: itemType, kind: 'generic' }
}
