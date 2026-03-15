import { useState, useEffect } from 'react'
import { Star, Clock, Pin, PinOff } from 'lucide-react'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useFavorites } from '../context/FavoritesContext'
import { useRecents } from '../hooks/useRecents'
import { ItemTypeIcon } from '../components/items/ItemIcons'
import { useResolvedIcon } from '../hooks/useResolvedIcon'
import { loadLucideIcon } from '../utils/lucide-registry'
import type { LucideIcon } from 'lucide-react'
import type { FavoriteItem, RecentItem, Item } from '../types'


// ── ItemIcon ──────────────────────────────────────────────────────────────────
// Full icon resolution pipeline — identical to ItemRow.
// Handles all four kinds: img (favicon/upload), emoji, library (Lucide), generic (type fallback).
// This is the ONLY correct way to render item icons — ItemTypeIcon alone is the last-resort fallback only.

function LibraryIcon({ name, type, color }: { name: string; type: Item['type']; color?: string }) {
  const [icon, setIcon] = useState<LucideIcon | null>(null)
  useEffect(() => { loadLucideIcon(name).then(setIcon) }, [name])
  if (!icon) return <ItemTypeIcon type={type} size={16} />   // skeleton fallback while async resolves
  const Icon = icon
  return (
    <Icon
      size={16}
      strokeWidth={1.75}
      className={color ? undefined : 'text-text-secondary'}
      style={color ? { color } : undefined}
    />
  )
}

function ItemIcon({ item }: { item: Item }) {
  const resolved = useResolvedIcon(
    item.iconPath,
    item.iconSource,
    item.type,
    item.type === 'url' ? item.path : undefined,
  )

  return (
    <span className="flex items-center justify-center w-5 h-5 shrink-0">
      {resolved.kind === 'img' && (
        <img src={resolved.value} className="w-4 h-4 object-contain rounded-sm" alt="" />
      )}
      {resolved.kind === 'emoji' && (
        <span className="text-base leading-none">{resolved.value}</span>
      )}
      {resolved.kind === 'library' && (
        <LibraryIcon name={resolved.value} type={item.type} color={item.iconColor || undefined} />
      )}
      {resolved.kind === 'generic' && (
        <ItemTypeIcon type={item.type} size={16} />
      )}
    </span>
  )
}


// ── Relative timestamp ────────────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60)     return 'just now'
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return `${Math.floor(diff / 604800)}w ago`
}

// ── Sortable favorite row ─────────────────────────────────────────────────────
function SortableFavRow({ fav, onLaunch, onUnpin }: {
  fav:      FavoriteItem
  onLaunch: (id: string) => void
  onUnpin:  (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: fav.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  return (
    <div ref={setNodeRef} style={style}
      className="group flex items-center gap-2 px-2 py-1.5 rounded-btn hover:bg-surface-3 transition-base duration-base"
    >
      <span {...attributes} {...listeners}
        className="text-text-muted opacity-0 group-hover:opacity-50 cursor-grab active:cursor-grabbing select-none text-[10px]"
      >⠿</span>

      <span onClick={() => onLaunch(fav.itemId)}
        className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
      >
        {/* ItemIcon: full pipeline — favicon, emoji, library, or type fallback */}
        <ItemIcon item={fav.item} />
        <span className="text-[0.8rem] text-text-primary truncate">{fav.item.label}</span>
      </span>

      <button
        onClick={e => { e.stopPropagation(); onUnpin(fav.itemId) }}
        title="Unpin from Home"
        className="opacity-0 group-hover:opacity-60 hover:!opacity-100 text-text-muted hover:text-danger
                   transition-base duration-base p-0.5 flex-shrink-0"
      >
        <PinOff className="w-3 h-3" />
      </button>
    </div>
  )
}


// ── Recent row ────────────────────────────────────────────────────────────────
function RecentRow({ recent, onLaunch, onPin, isPinned }: {
  recent:   RecentItem
  onLaunch: (id: string) => void
  onPin:    (id: string) => void
  isPinned: boolean
}) {
  return (
    <div
      className="group flex items-center gap-2 px-2 py-1.5 rounded-btn hover:bg-surface-3
                 transition-base duration-base cursor-pointer"
      onClick={() => onLaunch(recent.itemId)}
    >
      {/* ItemIcon: full pipeline — favicon, emoji, library, or type fallback */}
      <ItemIcon item={recent.item} />
      <span className="flex-1 min-w-0 text-[0.8rem] text-text-primary truncate">{recent.item.label}</span>
      <span className="text-[0.72rem] text-text-secondary flex-shrink-0">{timeAgo(recent.launchedAt)}</span>
      <button
        onClick={e => { e.stopPropagation(); if (!isPinned) onPin(recent.itemId) }}
        title={isPinned ? 'Already pinned' : 'Pin to Favorites'}
        disabled={isPinned}
        className={`opacity-0 group-hover:opacity-70 hover:!opacity-100 transition-base duration-base
                    p-0.5 flex-shrink-0 ml-0.5
                    ${isPinned ? 'text-accent cursor-default' : 'text-text-muted hover:text-accent'}`}
      >
        <Pin className="w-3 h-3" />
      </button>
    </div>
  )
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 px-1 pb-2 mb-2 border-b border-surface-4">
      <Icon className="w-3.5 h-3.5 text-text-muted" />
      <span className="text-[0.68rem] font-semibold text-text-secondary uppercase tracking-[0.1em]">{label}</span>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-10">
      <span className="text-[0.75rem] text-text-secondary text-center px-4">{message}</span>
    </div>
  )
}


// ── Main page ─────────────────────────────────────────────────────────────────
export default function HomePage() {
  const { favorites, favItemIds, pinItem, unpinItem, reorderFavorites, launchFavorite } = useFavorites()
  const { recents, launch: launchRecent } = useRecents(20)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = favorites.findIndex(f => f.id === active.id)
    const newIdx = favorites.findIndex(f => f.id === over.id)
    reorderFavorites(arrayMove(favorites, oldIdx, newIdx).map(f => f.id))
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 px-6 pt-5 pb-4">
        <h1 className="text-lg font-semibold text-text-primary">Home</h1>
        <p className="text-[0.75rem] text-text-secondary mt-0.5">Pinned favorites and recent launches</p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="grid grid-cols-2 gap-6">

          <div className="bg-surface-2 rounded-card p-4 shadow-card">
            <SectionHeader icon={Star} label="Favorites" />
            {favorites.length === 0
              ? <EmptyState message="Right-click any item → Pin to Home" />
              : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={favorites.map(f => f.id)} strategy={verticalListSortingStrategy}>
                    {favorites.map(fav => (
                      <SortableFavRow key={fav.id} fav={fav} onLaunch={launchFavorite} onUnpin={unpinItem} />
                    ))}
                  </SortableContext>
                </DndContext>
              )
            }
          </div>

          <div className="bg-surface-2 rounded-card p-4 shadow-card">
            <SectionHeader icon={Clock} label="Recently Used" />
            {recents.length === 0
              ? <EmptyState message="Items you launch will appear here" />
              : recents.map(r => (
                  <RecentRow
                    key={r.id}
                    recent={r}
                    onLaunch={launchRecent}
                    onPin={pinItem}
                    isPinned={favItemIds.has(r.itemId)}
                  />
                ))
            }
          </div>

        </div>
      </div>
    </div>
  )
}
