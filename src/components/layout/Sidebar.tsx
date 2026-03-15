import { Home, Settings, LayoutGrid, ArrowDownUp, Keyboard, Info, Pencil, Trash2 } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import GroupPillList, { type UserDivider } from '../groups/GroupPillList'
import type { Group } from '../../types'
import type { ActivePage, NavigateFn } from '../../types/navigation'

interface SidebarProps {
  groups:        Group[]
  activePage:    ActivePage
  navigate:      NavigateFn
  onReorder:     (orderedIds: string[]) => Promise<void>
  onAddGroup:    () => void
  onEditGroup:   (group: Group) => void
  onDeleteGroup: (id: string) => void
}

const PAGE_ICONS = [
  { type: 'settings'       as const, icon: Settings,    label: 'Settings'      },
  { type: 'group-manager'  as const, icon: LayoutGrid,  label: 'Group Manager' },
  { type: 'import-export'  as const, icon: ArrowDownUp, label: 'Import/Export' },
  { type: 'shortcuts'      as const, icon: Keyboard,    label: 'Shortcuts'     },
  { type: 'about'          as const, icon: Info,        label: 'About'         },
]

// ── DividerContextMenu ────────────────────────────────────────────────────────
// Right-click menu on a user divider — Rename or Delete.

interface DividerCtxMenuProps {
  x:        number
  y:        number
  label:    string
  onRename: (newLabel: string) => void
  onDelete: () => void
  onClose:  () => void
}

function DividerContextMenu({ x, y, label, onRename, onDelete, onClose }: DividerCtxMenuProps) {
  const ref      = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [pos, setPos]             = useState({ x, y })
  const [showRename, setShowRename] = useState(false)
  const [newLabel, setNewLabel]     = useState(label)

  // Nudge on-screen if near edge
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setPos({
      x: rect.right  > window.innerWidth  ? x - rect.width  : x,
      y: rect.bottom > window.innerHeight ? y - rect.height : y,
    })
  }, [x, y])

  // Close on Escape / outside click
  useEffect(() => {
    const onKey   = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    const onMouse = (e: MouseEvent)    => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('keydown',   onKey)
    document.addEventListener('mousedown', onMouse)
    return () => {
      document.removeEventListener('keydown',   onKey)
      document.removeEventListener('mousedown', onMouse)
    }
  }, [onClose])

  // Focus input when rename revealed
  useEffect(() => {
    if (showRename) setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 30)
  }, [showRename])

  function handleConfirmRename() {
    const t = newLabel.trim()
    if (!t) return
    onRename(t)
    onClose()
  }

  const row = 'w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-left transition-base duration-base hover:bg-surface-3'

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-surface-2 rounded-btn shadow-modal border border-surface-4 py-1 min-w-[148px]"
      style={{ left: pos.x, top: pos.y }}
      onContextMenu={e => e.preventDefault()}
    >
      {!showRename ? (
        <>
          {/* Rename */}
          <button className={`${row} text-text-secondary hover:text-text-primary`}
            onClick={() => setShowRename(true)}>
            <Pencil size={13} strokeWidth={1.75} className="text-text-secondary shrink-0" />
            <span>Rename</span>
          </button>

          {/* Delete */}
          <button className={`${row} text-danger hover:text-danger`}
            onClick={() => { onDelete(); onClose() }}>
            <Trash2 size={13} strokeWidth={1.75} className="text-danger shrink-0" />
            <span>Delete</span>
          </button>
        </>
      ) : (
        <div className="px-3 py-2 flex flex-col gap-2">
          <span className="text-[11px] text-text-muted">Rename divider</span>
          <input
            ref={inputRef}
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter')  handleConfirmRename()
              if (e.key === 'Escape') onClose()
            }}
            maxLength={24}
            className="h-7 px-2 text-xs bg-surface-3 border border-surface-4 rounded-input
                       text-text-primary placeholder:text-text-muted outline-none
                       focus:border-accent transition-base duration-base"
          />
          <div className="flex gap-1.5">
            <button
              onClick={handleConfirmRename}
              disabled={!newLabel.trim()}
              className="flex-1 h-6 text-[11px] rounded-btn bg-accent text-white
                         hover:bg-accent-hover transition-base duration-base disabled:opacity-40"
            >
              Save
            </button>
            <button
              onClick={onClose}
              className="flex-1 h-6 text-[11px] rounded-btn border border-surface-4
                         text-text-secondary hover:bg-surface-3 transition-base duration-base"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── SidebarDivider ────────────────────────────────────────────────────────────
// Exported so GroupPillList can import and render it inline between pills.
// Right-click opens a context menu with Rename / Delete — no hover icon.

export function SidebarDivider({
  label,
  onRename,
  onDelete,
}: {
  label:     string
  onRename?: (newLabel: string) => void
  onDelete?: () => void
}) {
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)

  function handleContextMenu(e: React.MouseEvent) {
    // Only show menu for user dividers (those with onDelete)
    if (!onDelete) return
    e.preventDefault()
    e.stopPropagation()
    setCtxMenu({ x: e.clientX, y: e.clientY })
  }

  return (
    <>
      <div
        className="flex items-center gap-2 px-3 py-1 shrink-0 cursor-default"
        onContextMenu={handleContextMenu}
      >
        <div className="flex-1 h-px bg-surface-4" />
        <span className="text-[9px] font-semibold uppercase tracking-widest text-text-muted shrink-0 select-none">
          {label}
        </span>
        <div className="flex-1 h-px bg-surface-4" />
      </div>

      {ctxMenu && onDelete && (
        <DividerContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          label={label}
          onRename={onRename ?? (() => {})}
          onDelete={onDelete}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </>
  )
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

export default function Sidebar({
  groups, activePage, navigate, onReorder, onAddGroup, onEditGroup, onDeleteGroup,
}: SidebarProps) {
  const isPageActive = (type: string) => activePage.type === type
  const [userDividers, setUserDividers] = useState<UserDivider[]>([])

  function handleInsertDivider(afterGroupId: string, label: string) {
    setUserDividers(prev => [
      ...prev,
      { id: `div-${Date.now()}`, afterGroupId, label },
    ])
  }

  function handleRenameDivider(id: string, newLabel: string) {
    setUserDividers(prev => prev.map(d => d.id === id ? { ...d, label: newLabel } : d))
  }

  function handleDeleteDivider(id: string) {
    setUserDividers(prev => prev.filter(d => d.id !== id))
  }

  return (
    <aside
      className="flex flex-col h-full bg-surface-1"
      style={{ width: '224px', minWidth: '224px' }}
    >

      {/* App name header */}
      <div className="flex items-center gap-3 px-4 shrink-0" style={{ height: '72px' }}>
        <div className="w-8 h-8 rounded-lg overflow-hidden shadow-sm shrink-0">
          <img src="./icon.png" alt="Command-Center" className="w-full h-full object-cover" />
        </div>
        <div className="flex flex-col gap-1 leading-none">
          <span className="text-text-primary font-bold text-[26px] tracking-tight leading-none">Command</span>
          <span className="text-accent text-[11px] font-semibold tracking-widest uppercase">Center</span>
        </div>
      </div>

      {/* Home button */}
      <div className="px-2 pt-2 pb-1 shrink-0">
        <button
          onClick={() => navigate({ type: 'home' })}
          className={[
            'w-full flex items-center gap-2.5 px-3 h-10 rounded-btn text-sm font-medium transition-base duration-base',
            isPageActive('home')
              ? 'bg-accent text-white shadow-sm'
              : 'text-text-secondary hover:bg-surface-3 hover:text-text-primary',
          ].join(' ')}
        >
          <Home size={16} className={isPageActive('home') ? 'text-white' : 'text-text-muted'} />
          <span>Home</span>
        </button>
      </div>

      {/* Static Groups divider — no right-click menu (no onDelete passed) */}
      <SidebarDivider label="Groups" />

      {/* Scrollable area */}
      <div className="flex-1 overflow-y-auto min-h-0 px-2">
        <GroupPillList
          groups={groups}
          activePage={activePage}
          navigate={navigate}
          onReorder={onReorder}
          onAddGroup={onAddGroup}
          onEditGroup={onEditGroup}
          onDeleteGroup={onDeleteGroup}
          onInsertDivider={handleInsertDivider}
          userDividers={userDividers}
          onDeleteDivider={handleDeleteDivider}
          onRenameDivider={handleRenameDivider}
        />
      </div>

      {/* Page icon bar */}
      <div className="shrink-0 border-t border-surface-2">
        <div className="flex items-center justify-around px-3 py-2">
          {PAGE_ICONS.map(({ type, icon: Icon, label }) => (
            <button
              key={type}
              title={label}
              aria-label={label}
              onClick={() => navigate({ type })}
              className={[
                'w-8 h-8 flex items-center justify-center rounded-btn transition-base duration-base',
                isPageActive(type)
                  ? 'text-accent bg-accent-soft'
                  : 'text-text-muted hover:text-text-primary hover:bg-surface-3',
              ].join(' ')}
            >
              <Icon size={24} />
            </button>
          ))}
        </div>
      </div>

    </aside>
  )
}
