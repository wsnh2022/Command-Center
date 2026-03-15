import { useState, useRef, useEffect } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { loadLucideIcon } from '../../utils/lucide-registry'
import type { LucideIcon } from 'lucide-react'
import type { Group } from '../../types'
import type { ActivePage, NavigateFn } from '../../types/navigation'

// ── Icon helpers ─────────────────────────────────────────────────────────────

function isLibraryIcon(s: string): boolean {
  return /^[A-Z][a-zA-Z0-9]+$/.test(s)
}


/**
 * PillIcon — renders the group icon in three modes:
 *   - no icon set     → coloured dot (accent when lit, surface-4 when muted)
 *   - library icon    → Lucide SVG (accent when lit, text-muted when not)
 *   - emoji / string  → plain text span (unaffected by lit state — emoji has its own colour)
 *
 * `lit` is true when the pill is active OR hovered — controlled by GroupPill.
 * This is the single place that decides icon colour, so future groups get
 * the same behaviour automatically via the accentColor prop.
 */
function PillIcon({
  icon,
  accentColor,
  lit,
}: {
  icon:        string
  accentColor: string
  lit:         boolean        // true = active or hovered → show accent colour
}) {
  const [lucideIcon, setLucideIcon] = useState<LucideIcon | null>(null)

  useEffect(() => {
    if (isLibraryIcon(icon)) {
      loadLucideIcon(icon).then(setLucideIcon)
    } else {
      setLucideIcon(null)
    }
  }, [icon])

  // No icon set — render a small dot
  if (!icon) {
    return (
      <span
        className="w-3 h-3 rounded-full shrink-0 transition-colors duration-150"
        style={{ background: lit ? accentColor : 'var(--surface-4)' }}
      />
    )
  }

  // Lucide library icon — muted at rest, accent when lit
  if (isLibraryIcon(icon)) {
    if (!lucideIcon) {
      // Loading skeleton — keeps layout stable
      return <span className="w-5 h-5 rounded-sm bg-surface-4 animate-pulse shrink-0" />
    }
    const Icon = lucideIcon
    return (
      <Icon
        size={21}
        strokeWidth={1.75}
        className="shrink-0 transition-colors duration-150"
        style={{ color: lit ? accentColor : 'var(--text-muted)' }}
      />
    )
  }

  // Emoji or plain string — colour is intrinsic, ignore lit state
  return <span className="text-xl leading-none w-5 text-center shrink-0">{icon}</span>
}


// ── Per-pill context menu ────────────────────────────────────────────────────

interface PillCtxMenuProps {
  x:        number
  y:        number
  group:    Group
  onEdit:   () => void
  onDelete: () => void
  onClose:  () => void
}

function PillContextMenu({ x, y, group, onEdit, onDelete, onClose }: PillCtxMenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x, y })

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
    function onKey(e: KeyboardEvent)   { if (e.key === 'Escape') onClose() }
    function onMouse(e: MouseEvent)    { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    document.addEventListener('keydown',   onKey)
    document.addEventListener('mousedown', onMouse)
    return () => {
      document.removeEventListener('keydown',   onKey)
      document.removeEventListener('mousedown', onMouse)
    }
  }, [onClose])


  const rowBase = 'w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-left transition-base duration-base hover:bg-surface-3'

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-surface-2 rounded-btn shadow-modal border border-surface-4 py-1 min-w-[148px]"
      style={{ left: pos.x, top: pos.y }}
      onContextMenu={e => e.preventDefault()}
    >
      <div className="px-3 py-1.5 text-xs text-text-muted font-medium truncate max-w-[160px]">
        {group.name}
      </div>
      <div className="my-1 border-t border-surface-4" />
      <button className={`${rowBase} text-text-secondary hover:text-text-primary`}
        onClick={() => { onEdit(); onClose() }}>
        <Pencil size={13} strokeWidth={1.75} className="text-text-secondary" />
        <span>Rename / Edit</span>
      </button>
      <button className={`${rowBase} text-danger hover:text-danger`}
        onClick={() => { onDelete(); onClose() }}>
        <Trash2 size={13} strokeWidth={1.75} className="text-danger" />
        <span>Delete</span>
      </button>
    </div>
  )
}


// ── Group pill ───────────────────────────────────────────────────────────────

interface GroupPillProps {
  group:    Group
  isActive: boolean
  navigate: NavigateFn
  onEdit:   (group: Group) => void
  onDelete: (id: string) => void
}

function GroupPill({ group, isActive, navigate, onEdit, onDelete }: GroupPillProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: group.id })

  const [hovered,  setHovered]  = useState(false)
  const [ctxMenu,  setCtxMenu]  = useState<{ x: number; y: number } | null>(null)

  // lit = icon should show accent colour — true when active OR hovered
  const lit = isActive || hovered

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
        {/* lit prop drives icon colour: muted at rest → accentColor on hover/active */}
        <PillIcon icon={group.icon ?? ''} accentColor={group.accentColor} lit={lit} />
        <span className="truncate">{group.name}</span>
      </button>

      {ctxMenu && (
        <PillContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          group={group}
          onEdit={() => onEdit(group)}
          onDelete={() => onDelete(group.id)}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  )
}


// ── Group pill list ──────────────────────────────────────────────────────────

interface GroupPillListProps {
  groups:        Group[]
  activePage:    ActivePage
  navigate:      NavigateFn
  onReorder:     (orderedIds: string[]) => Promise<void>
  onAddGroup:    () => void
  onEditGroup:   (group: Group) => void
  onDeleteGroup: (id: string) => void
}

export default function GroupPillList({
  groups, activePage, navigate, onReorder, onAddGroup, onEditGroup, onDeleteGroup,
}: GroupPillListProps) {
  const [localGroups, setLocalGroups] = useState<Group[]>(groups)

  useEffect(() => {
    setLocalGroups(groups)
  }, [groups])

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
              <GroupPill
                key={group.id}
                group={group}
                isActive={isGroupActive(group.id)}
                navigate={navigate}
                onEdit={onEditGroup}
                onDelete={onDeleteGroup}
              />
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
