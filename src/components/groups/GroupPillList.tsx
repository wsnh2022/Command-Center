import { useState, useRef, useEffect } from 'react'
import { Plus, Pencil, Trash2, Minus } from 'lucide-react'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { loadLucideIcon } from '../../utils/lucide-registry'
import type { LucideIcon } from 'lucide-react'
import type { Group } from '../../types'
import type { ActivePage, NavigateFn } from '../../types/navigation'
import { SidebarDivider } from '../layout/Sidebar'

function isLibraryIcon(s: string): boolean {
  return /^[A-Z][a-zA-Z0-9]+$/.test(s)
}

function PillIcon({ icon, accentColor, lit }: { icon: string; accentColor: string; lit: boolean }) {
  const [lucideIcon, setLucideIcon] = useState<LucideIcon | null>(null)
  useEffect(() => {
    if (isLibraryIcon(icon)) loadLucideIcon(icon).then(setLucideIcon)
    else setLucideIcon(null)
  }, [icon])

  if (!icon) return (
    <span className="w-3 h-3 rounded-full shrink-0 transition-colors duration-150"
      style={{ background: lit ? accentColor : 'var(--surface-4)' }} />
  )
  if (isLibraryIcon(icon)) {
    if (!lucideIcon) return <span className="w-5 h-5 rounded-sm bg-surface-4 animate-pulse shrink-0" />
    const Icon = lucideIcon
    return <Icon size={21} strokeWidth={1.75} className="shrink-0 transition-colors duration-150"
      style={{ color: lit ? accentColor : 'var(--text-muted)' }} />
  }
  return <span className="text-xl leading-none w-5 text-center shrink-0">{icon}</span>
}

// ── Per-pill context menu ─────────────────────────────────────────────────────

interface PillCtxMenuProps {
  x: number; y: number; group: Group
  onEdit: () => void
  onDelete: () => void
  onInsertDivider: (label: string) => void
  onClose: () => void
}

function PillContextMenu({ x, y, group, onEdit, onDelete, onInsertDivider, onClose }: PillCtxMenuProps) {
  const ref      = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [pos, setPos]             = useState({ x, y })
  const [showInput, setShowInput] = useState(false)
  const [divLabel, setDivLabel]   = useState('')

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setPos({
      x: rect.right  > window.innerWidth  ? x - rect.width  : x,
      y: rect.bottom > window.innerHeight ? y - rect.height : y,
    })
  }, [x, y])

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

  useEffect(() => {
    if (showInput) setTimeout(() => inputRef.current?.focus(), 30)
  }, [showInput])

  function handleConfirmDivider() {
    const t = divLabel.trim()
    if (!t) return
    onInsertDivider(t)
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
      <button className={`${row} text-text-secondary hover:text-text-primary`}
        onClick={() => { onEdit(); onClose() }}>
        <Pencil size={13} strokeWidth={1.75} className="text-text-secondary shrink-0" />
        <span>Rename / Edit</span>
      </button>

      <button className={`${row} text-danger hover:text-danger`}
        onClick={() => { onDelete(); onClose() }}>
        <Trash2 size={13} strokeWidth={1.75} className="text-danger shrink-0" />
        <span>Delete</span>
      </button>

      <div className="my-1 border-t border-surface-4" />

      {!showInput ? (
        <button className={`${row} text-text-secondary hover:text-text-primary`}
          onClick={() => setShowInput(true)}>
          <Minus size={13} strokeWidth={1.75} className="text-text-muted shrink-0" />
          <span>Insert divider after</span>
        </button>
      ) : (
        <div className="px-3 py-2 flex flex-col gap-2">
          <span className="text-[11px] text-text-muted">Divider label</span>
          <input
            ref={inputRef}
            value={divLabel}
            onChange={e => setDivLabel(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter')  handleConfirmDivider()
              if (e.key === 'Escape') onClose()
            }}
            placeholder="e.g. Tools…"
            maxLength={24}
            className="h-7 px-2 text-xs bg-surface-3 border border-surface-4 rounded-input
                       text-text-primary placeholder:text-text-muted outline-none
                       focus:border-accent transition-base duration-base"
          />
          <div className="flex gap-1.5">
            <button
              onClick={handleConfirmDivider}
              disabled={!divLabel.trim()}
              className="flex-1 h-6 text-[11px] rounded-btn bg-accent text-white
                         hover:bg-accent-hover transition-base duration-base disabled:opacity-40"
            >
              Add
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

// ── Group pill ────────────────────────────────────────────────────────────────

interface GroupPillProps {
  group: Group
  isActive: boolean
  navigate: NavigateFn
  onEdit: (group: Group) => void
  onDelete: (id: string) => void
  onInsertDivider: (afterGroupId: string, label: string) => void
}

function GroupPill({ group, isActive, navigate, onEdit, onDelete, onInsertDivider }: GroupPillProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: group.id })

  const [hovered, setHovered] = useState(false)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)

  const style = {
    transform:  CSS.Transform.toString(transform),
    transition,
    opacity:    isDragging ? 0.5 : 1,
    '--accent': group.accentColor,
  } as React.CSSProperties

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setCtxMenu({ x: e.clientX, y: e.clientY })
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <button
        onClick={() => navigate({ type: 'group', groupId: group.id })}
        onContextMenu={handleContextMenu}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={[
          'w-full flex items-center gap-2 px-3 h-9 rounded-btn text-sm transition-base duration-base text-left select-none',
          isActive
            ? 'text-text-primary border-l-2'
            : 'text-text-secondary hover:bg-surface-3 hover:text-text-primary',
        ].join(' ')}
        style={isActive ? { backgroundColor: `${group.accentColor}26`, borderColor: group.accentColor } : undefined}
      >
        <PillIcon icon={group.icon ?? ''} accentColor={group.accentColor} lit={isActive || hovered} />
        <span className="truncate">{group.name}</span>
      </button>

      {ctxMenu && (
        <PillContextMenu
          x={ctxMenu.x} y={ctxMenu.y} group={group}
          onEdit={() => onEdit(group)}
          onDelete={() => onDelete(group.id)}
          onInsertDivider={(label) => onInsertDivider(group.id, label)}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  )
}

// ── Divider entry type (shared with Sidebar) ──────────────────────────────────

export interface UserDivider {
  id:           string
  afterGroupId: string
  label:        string
}

// ── Group pill list ───────────────────────────────────────────────────────────

interface GroupPillListProps {
  groups:           Group[]
  activePage:       ActivePage
  navigate:         NavigateFn
  onReorder:        (orderedIds: string[]) => Promise<void>
  onAddGroup:       () => void
  onEditGroup:      (group: Group) => void
  onDeleteGroup:    (id: string) => void
  onInsertDivider:  (afterGroupId: string, label: string) => void
  userDividers:     UserDivider[]
  onDeleteDivider:  (id: string) => void
  onRenameDivider:  (id: string, newLabel: string) => void
}

export default function GroupPillList({
  groups, activePage, navigate, onReorder, onAddGroup, onEditGroup, onDeleteGroup,
  onInsertDivider, userDividers, onDeleteDivider, onRenameDivider,
}: GroupPillListProps) {
  const [localGroups, setLocalGroups] = useState<Group[]>(groups)
  useEffect(() => { setLocalGroups(groups) }, [groups])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = localGroups.findIndex(g => g.id === active.id)
    const newIndex = localGroups.findIndex(g => g.id === over.id)
    const reordered = arrayMove(localGroups, oldIndex, newIndex)
    setLocalGroups(reordered)
    onReorder(reordered.map(g => g.id)).catch(console.error)
  }

  const isGroupActive = (id: string) => activePage.type === 'group' && activePage.groupId === id

  return (
    <div className="flex flex-col gap-0.5">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={localGroups.map(g => g.id)} strategy={verticalListSortingStrategy}>
          {localGroups.length === 0 ? (
            <span className="text-text-muted text-xs px-3 py-2">No groups yet</span>
          ) : (
            localGroups.map(group => (
              <div key={group.id}>
                <GroupPill
                  group={group}
                  isActive={isGroupActive(group.id)}
                  navigate={navigate}
                  onEdit={onEditGroup}
                  onDelete={onDeleteGroup}
                  onInsertDivider={onInsertDivider}
                />
                {/* Render dividers inserted after this group — right-click to rename/delete */}
                {userDividers
                  .filter(d => d.afterGroupId === group.id)
                  .map(d => (
                    <SidebarDivider
                      key={d.id}
                      label={d.label}
                      onRename={(newLabel) => onRenameDivider(d.id, newLabel)}
                      onDelete={() => onDeleteDivider(d.id)}
                    />
                  ))
                }
              </div>
            ))
          )}
        </SortableContext>
      </DndContext>
      <button
        onClick={onAddGroup}
        className="w-full flex items-center gap-2 px-3 h-8 rounded-btn text-xs text-text-muted
                   hover:text-text-primary hover:bg-surface-3 transition-base duration-base mt-0.5"
      >
        <Plus size={13} />
        <span>Add Group</span>
      </button>
    </div>
  )
}
