import { useRef, useEffect, useMemo } from 'react'
import { Hash } from 'lucide-react'
import type { SearchResult } from '../../hooks/useSearch'
import { ItemTypeIcon } from '../items/ItemIcons'

interface SearchResultsProps {
  results:   SearchResult[]
  query:     string
  activeIdx: number          // -1 = nothing focused
  onSelect:  (result: SearchResult) => void
}

// ── Highlight matched substring (case-insensitive, simple approach) ───────────
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <span className="text-accent font-medium">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  )
}

// ── Group results by group → card ─────────────────────────────────────────────
interface ResultGroup {
  groupId:   string
  groupName: string
  cards: {
    cardId:   string
    cardName: string
    items:    (SearchResult & { flatIdx: number })[]
  }[]
}

function groupResults(results: SearchResult[]): ResultGroup[] {
  const groupMap = new Map<string, ResultGroup>()

  // First pass: build groups preserving insertion order, flatIdx is a placeholder
  results.forEach(r => {
    if (!groupMap.has(r.groupId)) {
      groupMap.set(r.groupId, { groupId: r.groupId, groupName: r.groupName, cards: [] })
    }
    const group = groupMap.get(r.groupId)!
    let card = group.cards.find(c => c.cardId === r.cardId)
    if (!card) {
      card = { cardId: r.cardId, cardName: r.cardName, items: [] }
      group.cards.push(card)
    }
    card.items.push({ ...r, flatIdx: 0 })
  })

  // Second pass: assign flatIdx in visual render order (group → card → items)
  // so ArrowDown/Up always moves to the visually adjacent row
  let idx = 0
  const groups = [...groupMap.values()]
  for (const group of groups) {
    for (const card of group.cards) {
      for (const item of card.items) {
        item.flatIdx = idx++
      }
    }
  }

  return groups
}

// ── Main component ────────────────────────────────────────────────────────────
export default function SearchResults({ results, query, activeIdx, onSelect }: SearchResultsProps) {
  const activeRef = useRef<HTMLButtonElement | null>(null)

  // Auto-scroll active row into view as keyboard moves through results
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx])

  const groups = useMemo(() => groupResults(results), [results])

  if (results.length === 0) return null

  return (
    <div
      className="absolute top-full left-0 right-0 mt-1 z-50
                 bg-surface-2 border border-surface-4 rounded-card shadow-modal
                 flex flex-col max-h-96"
      onMouseDown={e => e.preventDefault()}  // prevent input blur on click
    >
      <div className="overflow-y-auto py-1 flex-1">
        {groups.map(group => (
        <div key={group.groupId}>
          {/* Group header */}
          <div className="px-3 pt-2 pb-0.5 flex items-center gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              {group.groupName}
            </span>
          </div>

          {group.cards.map(card => (
            <div key={card.cardId}>
              {/* Card sub-header */}
              <div className="px-3 py-0.5 flex items-center gap-1 ml-2">
                <Hash size={11} className="text-text-muted flex-shrink-0" strokeWidth={2} />
                <span className="text-[11px] text-text-muted truncate">{card.cardName}</span>
              </div>

              {/* Item rows */}
              {card.items.map(item => {
                const isActive = item.flatIdx === activeIdx
                return (
                  <button
                    key={item.itemId}
                    ref={isActive ? activeRef : null}
                    onClick={() => onSelect(item)}
                    className={`w-full flex items-center gap-2.5 px-4 py-1.5 text-left
                               transition-base duration-base
                               ${isActive ? 'bg-accent-soft' : 'hover:bg-surface-3'}`}
                  >
                    <ItemTypeIcon type={item.type} size={16} className="flex-shrink-0" />
                    <span className="flex-1 min-w-0">
                      <span className="text-sm text-text-primary truncate block">
                        <Highlight text={item.label} query={query} />
                      </span>
                      {item.path && (
                        <span className="text-[12px] text-text-muted truncate block leading-tight">
                          <Highlight text={item.path} query={query} />
                        </span>
                      )}
                    </span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
        ))}
      </div>

      {/* Footer hint — outside scroll area so it stays visible */}
      <div className="px-3 py-1.5 border-t border-surface-4 flex items-center gap-3 shrink-0">
        <span className="text-[11px] text-text-muted">↑↓ navigate</span>
        <span className="text-[11px] text-text-muted">Enter launch</span>
        <span className="text-[11px] text-text-muted">Esc close</span>
      </div>
    </div>
  )
}
