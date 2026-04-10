import { useState, useEffect, useRef, useCallback } from 'react'
import Fuse from 'fuse.js'
import { ipc } from '../utils/ipc'
import type { SearchIndexEntry, ItemType } from '../types'

export interface SearchResult {
  itemId:    string
  label:     string
  path:      string
  type:      ItemType
  cardId:    string
  cardName:  string
  groupId:   string
  groupName: string
}

// Debounce - 150ms per spec
const DEBOUNCE_MS = 150
// Cap total results to avoid overwhelming the dropdown
const MAX_RESULTS = 30

export function useSearch(query: string): {
  results:      SearchResult[]
  refreshIndex: () => void
} {
  const [index,   setIndex]   = useState<SearchIndexEntry[]>([])
  const [results, setResults] = useState<SearchResult[]>([])
  const fuseRef   = useRef<Fuse<SearchIndexEntry> | null>(null)
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load / reload the full search index from main process
  const loadIndex = useCallback(() => {
    ipc.search.getIndex().then(entries => {
      setIndex(entries)
      fuseRef.current = new Fuse(entries, {
        keys: [
          { name: 'label',     weight: 3 },   // primary match signal
          { name: 'tags',      weight: 2 },   // tags are user-curated, high confidence
          { name: 'path',      weight: 1 },   // path / URL often contains relevant tokens
          { name: 'cardName',  weight: 0.5 }, // context - lower weight
          { name: 'groupName', weight: 0.5 },
        ],
        threshold: 0.35,           // 0 = exact, 1 = match anything; 0.35 is fuzzy but not sloppy
        includeScore: true,
        minMatchCharLength: 1,
      })
    }).catch(console.error)
  }, [])

  useEffect(() => {
    loadIndex()
    // Re-fetch index whenever items are mutated (move fires this event in ItemContextMenu)
    const onMutation = () => loadIndex()
    window.addEventListener('command-center:itemMoved', onMutation)
    return () => window.removeEventListener('command-center:itemMoved', onMutation)
  }, [loadIndex])

  // Debounced search - runs fuse.js + FTS5, merges, deduplicates
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)

    if (!query.trim()) {
      setResults([])
      return
    }

    timerRef.current = setTimeout(async () => {
      // Fuse.js fuzzy search across label/tags/path/card/group
      const fuseHits: SearchIndexEntry[] = fuseRef.current
        ? fuseRef.current.search(query).map(r => r.item)
        : []

      // FTS5 note body search - returns item IDs of notes that contain the query
      let ftIds: string[] = []
      try { ftIds = await ipc.search.fullText(query) } catch { /* non-fatal - FTS5 may be empty */ }

      // Merge: fuse first (ranked), then FTS5-only hits appended at the end
      const seen = new Set(fuseHits.map(e => e.itemId))
      const ftExtra = ftIds
        .filter(id => !seen.has(id))
        .map(id => index.find(e => e.itemId === id))
        .filter((e): e is SearchIndexEntry => e !== undefined)

      setResults([...fuseHits, ...ftExtra].slice(0, MAX_RESULTS).map(e => ({
        itemId:    e.itemId,
        label:     e.label,
        path:      e.path,
        type:      e.type,
        cardId:    e.cardId,
        cardName:  e.cardName,
        groupId:   e.groupId,
        groupName: e.groupName,
      })))
    }, DEBOUNCE_MS)

    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [query, index])

  return { results, refreshIndex: loadIndex }
}
