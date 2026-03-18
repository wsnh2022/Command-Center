import { useState, useRef, useEffect } from 'react'
import { Plus, Pencil, Trash2, Minus, GripVertical } from 'lucide-react'
import { useSettings } from '../../context/SettingsContext'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
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
    <div ref={ref}
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
          <input ref={inputRef} value={divLabel}
            onChange={e => setDivLabel(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter')  handleConfirmDivider()
              if (e.key === 'Escape') onClose()
            }}
            placeholder="e.g. Tools…" maxLength={24}
            className="h-7 px-2 text-xs bg-surface-3 border border-surface-4 rounded-input
                       text-text-primary placeholder:text-text-muted outline-none
                       focus:border-accent transition-base duration-base"
          />
          <div className="flex gap-1.5">
            <button onClick={handleConfirmDivider} disabled={!divLabel.trim()}
              className="flex-1 h-6 text-[11px] rounded-btn bg-accent text-white
                         hover:bg-accent-hover transition-base duration-base disabled:opacity-40">
              Add
            </button>
            <button onClick={onClose}
              className="flex-1 h-6 text-[11px] rounded-btn border border-surface-4
                         text-text-secondary hover:bg-surface-3 transition-base duration-base">
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
  const { settings } = useSettings()
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function cancelHoverTimer() {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
  }

  // Cancel any pending hover timer when a drag starts or component unmounts
  useEffect(() => {
    if (isDragging) cancelHoverTimer()
  }, [isDragging])

  useEffect(() => {
    return () => cancelHoverTimer()
  }, [])

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity:   isDragging ? 0.4 : 1,
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
        onClick={() => {
          cancelHoverTimer()
          navigate({ type: 'group', groupId: group.id })
        }}
        onContextMenu={handleContextMenu}
        onMouseEnter={() => {
          setHovered(true)
          if (settings?.hoverNavigate && !isActive && !isDragging) {
            hoverTimerRef.current = setTimeout(() => {
              navigate({ type: 'group', groupId: group.id })
            }, 300)
          }
        }}
        onMouseLeave={() => {
          setHovered(false)
          cancelHoverTimer()
        }}
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

// ── Sortable divider wrapper ──────────────────────────────────────────────────
// Wraps SidebarDivider in useSortable so it can be dragged within the mixed list.

function SortableDivider({
  divider, onRename, onDelete,
}: {
  divider:  UserDivider
  onRename: (newLabel: string) => void
  onDelete: () => void
}) {
  const { setNodeRef, transform, transition, isDragging, attributes, listeners } =
    useSortable({ id: divider.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity:   isDragging ? 0.4 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center group/drag">
      {/* Drag handle — visible on hover */}
      <span
        {...attributes}
        {...listeners}
        className="pl-1 pr-0.5 text-text-muted opacity-0 group-hover/drag:opacity-40
                   cursor-grab active:cursor-grabbing shrink-0"
      >
        <GripVertical size={12} />
      </span>
      <div className="flex-1">
        <SidebarDivider
          label={divider.label}
          onRename={onRename}
          onDelete={onDelete}
        />
      </div>
    </div>
  )
}

// ── Mixed item type ───────────────────────────────────────────────────────────

export interface UserDivider {
  id:           string
  afterGroupId: string
  label:        string
}

type MixedItem =
  | { kind: 'group';   id: string; group:   Group       }
  | { kind: 'divider'; id: string; divider: UserDivider }

function buildFlatList(groups: Group[], dividers: UserDivider[]): MixedItem[] {
  const list: MixedItem[] = []
  for (const group of groups) {
    list.push({ kind: 'group', id: group.id, group })
    for (const d of dividers.filter(d => d.afterGroupId === group.id)) {
      list.push({ kind: 'divider', id: d.id, divider: d })
    }
  }
  return list
}

// Derive updated dividers from the new flat order after a drag:
// each divider's afterGroupId becomes the nearest group above it.
function deriveAfterGroupIds(flat: MixedItem[], fallbackGroupId: string): UserDivider[] {
  const result: UserDivider[] = []
  let lastGroupId = fallbackGroupId
  for (const item of flat) {
    if (item.kind === 'group') {
      lastGroupId = item.group.id
    } else {
      result.push({ ...item.divider, afterGroupId: lastGroupId })
    }
  }
  return result
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
  onUpdateDividers: (updated: UserDivider[]) => void
}

export default function GroupPillList({
  groups, activePage, navigate, onReorder, onAddGroup, onEditGroup, onDeleteGroup,
  onInsertDivider, userDividers, onDeleteDivider, onRenameDivider, onUpdateDividers,
}: GroupPillListProps) {
  const [localGroups, setLocalGroups] = useState<Group[]>(groups)
  useEffect(() => { setLocalGroups(groups) }, [groups])

  // Single flat list: groups + dividers interleaved by afterGroupId
  const flatList = buildFlatList(localGroups, userDividers)
  const flatIds  = flatList.map(item => item.id)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIdx = flatIds.indexOf(active.id as string)
    const newIdx = flatIds.indexOf(over.id  as string)
    if (oldIdx === -1 || newIdx === -1) return

    const newFlat = arrayMove(flatList, oldIdx, newIdx)

    // New group order (filter out dividers)
    const newGroups = newFlat.filter(i => i.kind === 'group').map(i => (i as Extract<MixedItem, { kind: 'group' }>).group)

    // New divider afterGroupId (derived from position in new flat list)
    const fallback = newGroups[0]?.id ?? ''
    const newDividers = deriveAfterGroupIds(newFlat, fallback)

    // Update groups if order changed
    const groupOrderChanged = newGroups.map(g => g.id).join() !== localGroups.map(g => g.id).join()
    if (groupOrderChanged) {
      setLocalGroups(newGroups)
      onReorder(newGroups.map(g => g.id)).catch(console.error)
    }

    // Update dividers if any afterGroupId changed
    const dividersChanged = newDividers.some(
      (d, i) => d.afterGroupId !== userDividers.find(u => u.id === d.id)?.afterGroupId
    )
    if (dividersChanged) {
      onUpdateDividers(newDividers)
    }
  }

  const isGroupActive = (id: string) => activePage.type === 'group' && activePage.groupId === id

  return (
    <div className="flex flex-col gap-0.5">
      {/* Single DndContext covers both groups and dividers */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={flatIds} strategy={verticalListSortingStrategy}>
          {flatList.length === 0 ? (
            <span className="text-text-muted text-xs px-3 py-2">No groups yet</span>
          ) : (
            flatList.map(item =>
              item.kind === 'group' ? (
                <GroupPill
                  key={item.id}
                  group={item.group}
                  isActive={isGroupActive(item.group.id)}
                  navigate={navigate}
                  onEdit={onEditGroup}
                  onDelete={onDeleteGroup}
                  onInsertDivider={onInsertDivider}
                />
              ) : (
                <SortableDivider
                  key={item.id}
                  divider={item.divider}
                  onRename={(newLabel) => onRenameDivider(item.divider.id, newLabel)}
                  onDelete={() => onDeleteDivider(item.divider.id)}
                />
              )
            )
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
