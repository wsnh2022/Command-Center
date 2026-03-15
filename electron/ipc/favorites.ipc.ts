import { ipcMain } from 'electron'
import { getDb } from '../db/database'
import { getFavorites, pinItem, unpinItem, reorderFavorites } from '../db/queries/favorites.queries'
import { sanitizeId } from '../utils/sanitize'

export function registerFavoriteHandlers(): void {

  ipcMain.handle('favorites:getAll', () => getFavorites(getDb()))

  ipcMain.handle('favorites:pin', (_e, input) => {
    const itemId = sanitizeId(input?.itemId)
    if (!itemId) throw new Error('Invalid item id')
    pinItem(getDb(), itemId)
    return { success: true }
  })

  ipcMain.handle('favorites:unpin', (_e, input) => {
    const itemId = sanitizeId(input?.itemId)
    if (!itemId) throw new Error('Invalid item id')
    unpinItem(getDb(), itemId)
    return { success: true }
  })

  ipcMain.handle('favorites:reorder', (_e, input) => {
    const raw: unknown[] = Array.isArray(input?.ids) ? input.ids : []
    const ids = raw.map(id => sanitizeId(id as string)).filter(Boolean) as string[]
    if (ids.length === 0) throw new Error('Empty reorder list')
    reorderFavorites(getDb(), ids)
    return { success: true }
  })
}
