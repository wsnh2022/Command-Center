import { ipcMain } from 'electron'
import { getDb } from '../db/database'
import { autoBackup } from '../services/backup.service'
import {
  getAllDividers,
  createDivider,
  updateDivider,
  deleteDivider,
  reorderDividers,
} from '../db/queries/dividers.queries'
import { sanitizeString, sanitizeId } from '../utils/sanitize'

export function registerDividerHandlers(): void {

  ipcMain.handle('dividers:getAll', () => {
    return getAllDividers(getDb())
  })

  ipcMain.handle('dividers:create', (_e, input) => {
    const label        = sanitizeString(input?.label, 24)
    const afterGroupId = sanitizeId(input?.afterGroupId)
    if (!afterGroupId) throw new Error('dividers:create — invalid afterGroupId')

    const divider = createDivider(getDb(), { label, afterGroupId })
    autoBackup()
    return divider
  })

  ipcMain.handle('dividers:update', (_e, input) => {
    const id = sanitizeId(input?.id)
    if (!id) throw new Error('dividers:update — invalid id')

    const patch: { id: string; label?: string; afterGroupId?: string; sortOrder?: number } = { id }
    if (input?.label        !== undefined) patch.label        = sanitizeString(input.label, 24)
    if (input?.afterGroupId !== undefined) patch.afterGroupId = sanitizeId(input.afterGroupId)
    if (input?.sortOrder    !== undefined) patch.sortOrder    = Number(input.sortOrder)

    const divider = updateDivider(getDb(), patch)
    autoBackup()
    return divider
  })

  ipcMain.handle('dividers:delete', (_e, input) => {
    const id = sanitizeId(input?.id)
    if (!id) throw new Error('dividers:delete — invalid id')

    const success = deleteDivider(getDb(), id)
    if (success) autoBackup()
    return { success }
  })

  ipcMain.handle('dividers:reorder', (_e, input) => {
    const updates = (input?.updates ?? []) as { id: string; afterGroupId: string; sortOrder: number }[]
    const sanitized = updates
      .map(u => ({
        id:           sanitizeId(u.id),
        afterGroupId: sanitizeId(u.afterGroupId),
        sortOrder:    Number(u.sortOrder),
      }))
      .filter(u => u.id && u.afterGroupId)

    if (sanitized.length === 0) return { success: true }

    const success = reorderDividers(getDb(), sanitized)
    if (success) autoBackup()
    return { success }
  })
}
