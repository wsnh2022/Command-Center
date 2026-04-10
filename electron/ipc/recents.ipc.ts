import { ipcMain } from 'electron'
import { getDb } from '../db/database'
import { getRecents, recordLaunch } from '../db/queries/recents.queries'
import { sanitizeId } from '../utils/sanitize'

export function registerRecentHandlers(): void {

  ipcMain.handle('recents:get', (_e, input) => {
    const limit = typeof input?.limit === 'number' ? Math.min(input.limit, 20) : 20
    return getRecents(getDb(), limit)
  })

  ipcMain.handle('recents:record', (_e, input) => {
    const itemId = sanitizeId(input?.itemId)
    if (!itemId) throw new Error('Invalid item id')
    recordLaunch(getDb(), itemId)
    // void return - renderer does not await result
  })
}
