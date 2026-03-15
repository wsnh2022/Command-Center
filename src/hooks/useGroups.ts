import { useState, useCallback, useEffect } from 'react'
import type { Group, CreateGroupInput, UpdateGroupInput } from '../types'
import { ipc } from '../utils/ipc'

export interface UseGroupsResult {
  groups:        Group[]
  setGroups:     React.Dispatch<React.SetStateAction<Group[]>>
  createGroup:   (input: CreateGroupInput) => Promise<Group>
  updateGroup:   (input: UpdateGroupInput) => Promise<void>
  deleteGroup:   (id: string) => Promise<void>
  reorderGroups: (orderedIds: string[]) => Promise<void>
  refresh:       () => Promise<void>
}

export function useGroups(): UseGroupsResult {
  const [groups, setGroups] = useState<Group[]>([])

  // Load all groups on mount
  useEffect(() => {
    ipc.groups.getAll().then(setGroups).catch(console.error)
  }, [])

  const refresh = useCallback(async () => {
    const all = await ipc.groups.getAll()
    setGroups(all)
  }, [])

  const createGroup = useCallback(async (input: CreateGroupInput): Promise<Group> => {
    const created = await ipc.groups.create(input)
    setGroups(prev => [...prev, created])
    return created
  }, [])

  const updateGroup = useCallback(async (input: UpdateGroupInput): Promise<void> => {
    await ipc.groups.update(input)
    setGroups(prev => prev.map(g => g.id === input.id ? { ...g, ...input } : g))
  }, [])

  const deleteGroup = useCallback(async (id: string): Promise<void> => {
    await ipc.groups.delete(id)
    setGroups(prev => prev.filter(g => g.id !== id))
  }, [])

  const reorderGroups = useCallback(async (orderedIds: string[]): Promise<void> => {
    await ipc.groups.reorder(orderedIds)
    setGroups(prev => {
      const map = new Map(prev.map(g => [g.id, g]))
      return orderedIds.map((id, i) => ({ ...map.get(id)!, sortOrder: i }))
    })
  }, [])

  return { groups, setGroups, createGroup, updateGroup, deleteGroup, reorderGroups, refresh }
}
