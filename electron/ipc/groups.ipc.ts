import { ipcMain } from 'electron'
import { getDb } from '../db/database'
import {
  getAllGroups, createGroup, updateGroup, deleteGroup, reorderGroups, getGroupCardCounts
} from '../db/queries/groups.queries'
import { sanitizeString, sanitizeId, sanitizeColor } from '../utils/sanitize'
import type { CreateGroupInput } from '../../src/types'
import { autoBackup } from '../services/backup.service'

export function registerGroupHandlers(): void {

  ipcMain.handle('groups:getAll', () => {
    return getAllGroups(getDb())
  })

  ipcMain.handle('groups:create', (_e, input) => {
    const name = sanitizeString(input?.name, 100)
    if (!name) throw new Error('Group name is required')
    const result = createGroup(getDb(), {
      name,
      icon:        sanitizeString(input?.icon, 200),
      iconSource:  sanitizeString(input?.iconSource, 20) as CreateGroupInput['iconSource'],
      iconColor:   sanitizeString(input?.iconColor, 20),
      accentColor: sanitizeColor(input?.accentColor),
    })
    autoBackup()
    return result
  })

  ipcMain.handle('groups:update', (_e, input) => {
    const id = sanitizeId(input?.id)
    if (!id) throw new Error('Invalid group id')
    const result = updateGroup(getDb(), {
      id,
      name:        input?.name ? sanitizeString(input.name, 100) : undefined,
      icon:        input?.icon !== undefined ? sanitizeString(input.icon, 200) : undefined,
      iconSource:  input?.iconSource ? sanitizeString(input.iconSource, 20) as CreateGroupInput['iconSource'] : undefined,
      iconColor:   input?.iconColor !== undefined ? sanitizeString(input.iconColor, 20) : undefined,
      accentColor: input?.accentColor ? sanitizeColor(input.accentColor) : undefined,
      sortOrder:   typeof input?.sortOrder === 'number' ? input.sortOrder : undefined,
    })
    autoBackup()
    return result
  })

  ipcMain.handle('groups:delete', (_e, input) => {
    const id = sanitizeId(input?.id)
    if (!id) throw new Error('Invalid group id')
    const success = deleteGroup(getDb(), id)
    autoBackup()
    return { success }
  })

  ipcMain.handle('groups:getCardCounts', () => {
    return getGroupCardCounts(getDb())
  })

  ipcMain.handle('groups:reorder', (_e, input) => {
    const ids: string[] = Array.isArray(input?.ids)
      ? input.ids.map((id: unknown) => sanitizeId(id)).filter(Boolean)
      : []
    const success = reorderGroups(getDb(), ids)
    autoBackup()
    return { success }
  })
}
