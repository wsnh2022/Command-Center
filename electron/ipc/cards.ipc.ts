import { ipcMain } from 'electron'
import { getDb } from '../db/database'
import {
  getCardsByGroup, createCard, updateCard, deleteCard, reorderCards, moveCard
} from '../db/queries/cards.queries'
import { sanitizeString, sanitizeId } from '../utils/sanitize'
import { autoBackup } from '../services/backup.service'

export function registerCardHandlers(): void {

  ipcMain.handle('cards:getByGroup', (_e, input) => {
    const groupId = sanitizeId(input?.groupId)
    if (!groupId) throw new Error('Invalid group id')
    return getCardsByGroup(getDb(), groupId)
  })

  ipcMain.handle('cards:create', (_e, input) => {
    const groupId = sanitizeId(input?.groupId)
    const name    = sanitizeString(input?.name, 100)
    if (!groupId) throw new Error('Invalid group id')
    if (!name)    throw new Error('Card name is required')
    const result = createCard(getDb(), {
      groupId,
      name,
      icon: sanitizeString(input?.icon, 200),
    })
    autoBackup()
    return result
  })

  ipcMain.handle('cards:update', (_e, input) => {
    const id = sanitizeId(input?.id)
    if (!id) throw new Error('Invalid card id')
    const result = updateCard(getDb(), {
      id,
      name:      input?.name ? sanitizeString(input.name, 100) : undefined,
      icon:      input?.icon !== undefined ? sanitizeString(input.icon, 200) : undefined,
      sortOrder: typeof input?.sortOrder === 'number' ? input.sortOrder : undefined,
    })
    autoBackup()
    return result
  })

  ipcMain.handle('cards:delete', (_e, input) => {
    const id = sanitizeId(input?.id)
    if (!id) throw new Error('Invalid card id')
    const success = deleteCard(getDb(), id)
    autoBackup()
    return { success }
  })

  ipcMain.handle('cards:move', (_e, input) => {
    const cardId        = sanitizeId(input?.cardId)
    const targetGroupId = sanitizeId(input?.targetGroupId)
    if (!cardId || !targetGroupId) throw new Error('Invalid ids')
    const result = moveCard(getDb(), cardId, targetGroupId)
    autoBackup()
    return { success: !!result, card: result }
  })

  ipcMain.handle('cards:reorder', (_e, input) => {
    const ids: string[] = Array.isArray(input?.ids)
      ? input.ids.map((id: unknown) => sanitizeId(id)).filter(Boolean)
      : []
    const success = reorderCards(getDb(), ids)
    autoBackup()
    return { success }
  })
}
