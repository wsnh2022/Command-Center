import { useState, useCallback, useEffect } from 'react'
import type { Divider } from '../types'
import { ipc } from '../utils/ipc'

export interface UseDividersResult {
  dividers:        Divider[]
  createDivider:   (afterGroupId: string, label: string) => Promise<Divider>
  updateDivider:   (id: string, label: string) => Promise<void>
  deleteDivider:   (id: string) => Promise<void>
  reorderDividers: (updated: Divider[]) => Promise<void>
}

export function useDividers(): UseDividersResult {
  const [dividers, setDividers] = useState<Divider[]>([])

  useEffect(() => {
    ipc.dividers.getAll().then(setDividers).catch(console.error)
  }, [])

  const createDivider = useCallback(async (afterGroupId: string, label: string): Promise<Divider> => {
    const created = await ipc.dividers.create({ afterGroupId, label })
    setDividers(prev => [...prev, created])
    return created
  }, [])

  const updateDivider = useCallback(async (id: string, label: string): Promise<void> => {
    await ipc.dividers.update({ id, label })
    setDividers(prev => prev.map(d => d.id === id ? { ...d, label } : d))
  }, [])

  const deleteDivider = useCallback(async (id: string): Promise<void> => {
    await ipc.dividers.delete(id)
    setDividers(prev => prev.filter(d => d.id !== id))
  }, [])

  // Called after every drag reorder with the full updated divider list.
  // Derives sortOrder from array index and batch-persists to DB.
  const reorderDividers = useCallback(async (updated: Divider[]): Promise<void> => {
    setDividers(updated)
    const updates = updated.map((d, i) => ({
      id:           d.id,
      afterGroupId: d.afterGroupId,
      sortOrder:    i,
    }))
    await ipc.dividers.reorder(updates)
  }, [])

  return { dividers, createDivider, updateDivider, deleteDivider, reorderDividers }
}
