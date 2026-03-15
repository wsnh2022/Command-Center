/**
 * GroupIconPicker.tsx
 * Focused Lucide library picker for group icons.
 * No tabs — library grid only. Click an icon to select and close immediately.
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { X } from 'lucide-react'
import dynamicIconImports from 'lucide-react/dynamicIconImports'
import { loadLucideIcon } from '../../utils/lucide-registry'
import type { LucideIcon } from 'lucide-react'

// ── Icon name list (same source as IconPicker.tsx) ────────────────────────────
function kebabToPascal(kebab: string): string {
  return kebab.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')
}
const ALL_ICON_NAMES: string[] = Object.keys(dynamicIconImports).map(kebabToPascal)
const SEARCH_LIMIT = 200

// Virtual scroll constants — 8 cols at 380px modal width
const COLS        = 8
const CELL_SIZE   = 40
const BUFFER_ROWS = 4

// ── Grid item ─────────────────────────────────────────────────────────────────

function GridItem({ name, active, onSelect }: {
  name:     string
  active:   boolean
  onSelect: (n: string) => void
}) {
  const [icon, setIcon] = useState<LucideIcon | null>(null)
  useEffect(() => { loadLucideIcon(name).then(setIcon) }, [name])
  const Icon = icon
  return (
    <button
      onClick={() => onSelect(name)}
      className={[
        'group relative flex items-center justify-center rounded-btn transition-base duration-base focus:outline-none',
        active
          ? 'bg-accent-soft text-text-primary'
          : 'text-text-secondary hover:bg-surface-3 hover:text-text-primary',
      ].join(' ')}
      style={{ width: CELL_SIZE - 4, height: CELL_SIZE - 4 }}
    >
      {Icon
        ? <Icon size={16} strokeWidth={1.75} />
        : <span className="w-4 h-4 rounded-sm bg-surface-4 animate-pulse" />
      }
      <span className={[
        'absolute top-full left-1/2 -translate-x-1/2 mt-1 px-1.5 py-0.5',
        'text-[10px] leading-tight text-text-primary bg-surface-1 border border-surface-4',
        'rounded shadow-md whitespace-nowrap pointer-events-none z-20',
        'transition-opacity duration-fast',
        active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
      ].join(' ')}>
        {name}
      </span>
    </button>
  )
}

// ── Main modal ────────────────────────────────────────────────────────────────

interface GroupIconPickerProps {
  current:  string          // currently selected icon name ('' if none)
  onSelect: (name: string) => void
  onClose:  () => void
}

export default function GroupIconPicker({ current, onSelect, onClose }: GroupIconPickerProps) {
  const [search,    setSearch]    = useState('')
  const [scrollTop, setScrollTop] = useState(0)
  const [viewHeight, setViewHeight] = useState(320)
  const scrollRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // Focus search on open
  useEffect(() => { searchRef.current?.focus() }, [])

  // Escape to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Track container height for virtual scroll
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setViewHeight(el.clientHeight))
    ro.observe(el)
    setViewHeight(el.clientHeight)
    return () => ro.disconnect()
  }, [])

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop((e.currentTarget as HTMLDivElement).scrollTop)
  }, [])

  const lower   = search.trim().toLowerCase()
  const toShow  = lower
    ? ALL_ICON_NAMES.filter(n => n.toLowerCase().includes(lower)).slice(0, SEARCH_LIMIT)
    : ALL_ICON_NAMES

  // Virtual window
  const totalRows   = Math.ceil(toShow.length / COLS)
  const firstRow    = Math.max(0, Math.floor(scrollTop / CELL_SIZE) - BUFFER_ROWS)
  const visibleRows = Math.ceil(viewHeight / CELL_SIZE) + BUFFER_ROWS * 2
  const lastRow     = Math.min(totalRows - 1, firstRow + visibleRows)
  const firstIdx    = firstRow * COLS
  const lastIdx     = Math.min(toShow.length - 1, (lastRow + 1) * COLS - 1)
  const paddingTop  = firstRow * CELL_SIZE
  const paddingBot  = Math.max(0, (totalRows - lastRow - 1)) * CELL_SIZE
  const visible     = toShow.slice(firstIdx, lastIdx + 1)

  function handleSelect(name: string) {
    onSelect(name)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="bg-surface-2 rounded-modal shadow-modal border border-surface-4 flex flex-col"
        style={{ width: 380, maxHeight: '70vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-4 shrink-0">
          <h2 className="text-sm font-semibold text-text-primary">Choose Icon</h2>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-btn text-text-muted hover:text-text-primary hover:bg-surface-3 transition-base duration-base"
          >
            <X size={14} />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-surface-4 shrink-0 flex items-center gap-2">
          <input
            ref={searchRef}
            value={search}
            onChange={e => { setSearch(e.target.value); setScrollTop(0) }}
            placeholder={`Search ${ALL_ICON_NAMES.length} icons…`}
            className="flex-1 h-8 px-3 text-sm bg-surface-3 rounded-input border border-surface-4 text-text-primary placeholder:text-text-muted outline-none focus:border-accent transition-base duration-base"
          />
          {lower && (
            <span className="text-[11px] text-text-muted shrink-0">
              {toShow.length}{toShow.length === SEARCH_LIMIT ? '+' : ''}
            </span>
          )}
        </div>

        {/* Virtual scroll grid */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="overflow-y-auto flex-1 px-4 py-3"
          style={{ minHeight: 0 }}
        >
          {paddingTop > 0 && <div style={{ height: paddingTop }} />}

          <div
            className="grid gap-1"
            style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}
          >
            {visible.map(name => (
              <GridItem
                key={name}
                name={name}
                active={current === name}
                onSelect={handleSelect}
              />
            ))}
          </div>

          {paddingBot > 0 && <div style={{ height: paddingBot }} />}

          {lower && toShow.length === 0 && (
            <p className="text-xs text-text-muted text-center py-6">No icons match "{search}"</p>
          )}
        </div>
      </div>
    </div>
  )
}
