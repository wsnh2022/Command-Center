import { ipcMain } from 'electron'
import { autoBackup } from '../services/backup.service'
import { launchItem } from '../services/launch.service'
import { getDb } from '../db/database'
import {
  getItemsByCard, getAllItems, getItemById,
  createItem, updateItem, deleteItem, moveItem, reorderItems, incrementLaunchCount,
  getSearchIndex, fullTextSearch, getItemCountsByCard,
} from '../db/queries/items.queries'
import { recordLaunch } from '../db/queries/recents.queries'
import {
  sanitizeString, sanitizeId, sanitizeItemType,
  sanitizeIconSource, sanitizePath, sanitizeUrl,
} from '../utils/sanitize'
import { extractFileIcon } from '../services/icon.service'

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

export function registerItemHandlers(): void {

  ipcMain.handle('items:getByCard', (_e, input) => {
    const cardId = sanitizeId(input?.cardId)
    if (!cardId) throw new Error('Invalid card id')
    return getItemsByCard(getDb(), cardId)
  })

  ipcMain.handle('items:getAll', () => {
    return getAllItems(getDb())
  })

  ipcMain.handle('items:create', async (_e, input) => {
    const cardId = sanitizeId(input?.cardId)
    const label  = sanitizeString(input?.label, 200)
    const type   = sanitizeItemType(input?.type)
    if (!cardId) throw new Error('Invalid card id')
    if (!label)  throw new Error('Item label is required')
    if (!type)   throw new Error('Item type is required')

    // Sanitize path based on type — URLs get URL sanitization, paths get path sanitization
    const path = type === 'url'
      ? sanitizeUrl(input?.path) || sanitizeString(input?.path, 2048)
      : sanitizePath(input?.path)

    const tags = Array.isArray(input?.tags)
      ? input.tags.map((t: unknown) => sanitizeString(t, 50)).filter(Boolean)
      : []

    let iconPath   = sanitizeString(input?.iconPath, 500)
    let iconSource = sanitizeIconSource(input?.iconSource) as 'auto' | 'favicon' | 'custom' | 'emoji' | 'library'

    // Save-time fallback: extract file icon for software items with no custom icon set
    if (type === 'software' && (!iconPath) && iconSource === 'auto' && path) {
      const extracted = await extractFileIcon(path)
      if (extracted) { iconPath = extracted; iconSource = 'custom' }
    }

    const newItem = createItem(getDb(), {
      cardId,
      label,
      path,
      type:        type as 'url' | 'software' | 'folder' | 'command',
      iconPath,
      iconSource,
      note:        sanitizeString(input?.note, 5000),
      tags,
      commandArgs: sanitizeString(input?.commandArgs, 2048),           // command type: args string
      workingDir:  sanitizePath(input?.workingDir) ?? '',              // command type: cwd
      iconColor:   sanitizeString(input?.iconColor, 20),               // library icons: hex colour or ''
    })
    autoBackup()
    return newItem
  })

  ipcMain.handle('items:update', async (_e, input) => {
    const id = sanitizeId(input?.id)
    if (!id) throw new Error('Invalid item id')

    const type = input?.type ? sanitizeItemType(input.type) : undefined
    const path = input?.path !== undefined
      ? (type === 'url'
          ? sanitizeUrl(input.path) || sanitizeString(input.path, 2048)
          : sanitizePath(input.path))
      : undefined

    const tags = Array.isArray(input?.tags)
      ? input.tags.map((t: unknown) => sanitizeString(t, 50)).filter(Boolean)
      : undefined

    let iconPath   = input?.iconPath   !== undefined ? sanitizeString(input.iconPath, 500) : undefined
    let iconSource = input?.iconSource !== undefined
      ? sanitizeIconSource(input.iconSource) as 'auto' | 'favicon' | 'custom' | 'emoji' | 'library'
      : undefined

    // Save-time fallback: extract file icon for software items with no custom icon set
    if (type === 'software' && (!iconPath) && iconSource === 'auto' && path) {
      const extracted = await extractFileIcon(path)
      if (extracted) { iconPath = extracted; iconSource = 'custom' }
    }

    const updatedItem = updateItem(getDb(), {
      id,
      label:       input?.label       !== undefined ? sanitizeString(input.label, 200)    : undefined,
      path,
      type:        type as 'url' | 'software' | 'folder' | 'command' | undefined,
      iconPath,
      iconSource,
      note:        input?.note        !== undefined ? sanitizeString(input.note, 5000)    : undefined,
      sortOrder:   typeof input?.sortOrder === 'number'  ? input.sortOrder               : undefined,
      tags,
      commandArgs: input?.commandArgs !== undefined ? sanitizeString(input.commandArgs, 2048) : undefined,
      workingDir:  input?.workingDir  !== undefined ? (sanitizePath(input.workingDir) ?? '')  : undefined,
      iconColor:   input?.iconColor   !== undefined ? sanitizeString(input.iconColor, 20)      : undefined,
    })
    autoBackup()
    return updatedItem
  })

  ipcMain.handle('items:delete', (_e, input) => {
    const id = sanitizeId(input?.id)
    if (!id) throw new Error('Invalid item id')
    const success = deleteItem(getDb(), id)
    autoBackup()
    return { success }
  })

  ipcMain.handle('items:move', (_e, input) => {
    const itemId       = sanitizeId(input?.itemId)
    const targetCardId = sanitizeId(input?.targetCardId)
    if (!itemId || !targetCardId) throw new Error('Invalid ids')
    const success = moveItem(getDb(), itemId, targetCardId)
    autoBackup()
    return { success }
  })


  ipcMain.handle('items:reorder', (_e, input) => {
    const updates = Array.isArray(input?.updates) ? input.updates : []
    const sanitized = updates
      .map((u: unknown) => {
        const entry = u as Record<string, unknown>
        const id = sanitizeId(entry?.id)
        const sortOrder = typeof entry?.sortOrder === 'number' ? entry.sortOrder : null
        return id !== null && sortOrder !== null ? { id, sortOrder } : null
      })
      .filter((u): u is { id: string; sortOrder: number } => u !== null)
    if (sanitized.length === 0) return { success: true }
    reorderItems(getDb(), sanitized)
    autoBackup()
    return { success: true }
  })

  ipcMain.handle('items:launch', async (_e, input) => {
    const id = sanitizeId(input?.id)
    if (!id) throw new Error('Invalid item id')

    const item = getItemById(getDb(), id)
    if (!item) throw new Error('Item not found')

    const result = await launchItem(item)

    if (result.success) {
      incrementLaunchCount(getDb(), id)
      recordLaunch(getDb(), id)
    }

    return result
  })

  ipcMain.handle('items:getCountsByCard', () => {
    return getItemCountsByCard(getDb())
  })
}

// ─── Search handlers (item domain) ───────────────────────────────────────────

export function registerSearchHandlers(): void {

  ipcMain.handle('search:getIndex', () => {
    return getSearchIndex(getDb())
  })

  ipcMain.handle('search:fullText', (_e, input) => {
    const query = sanitizeString(input?.query, 200)
    if (!query) return []
    return fullTextSearch(getDb(), query)
  })
}
