import { useEffect, useState } from 'react'
import { useCards } from '../hooks/useCards'
import CardGrid from '../components/cards/CardGrid'
import { loadLucideIcon } from '../utils/lucide-registry'
import type { LucideIcon } from 'lucide-react'
import type { Group } from '../types'

function GroupHeaderIcon({ group }: { group: Group }) {
  const [lucideIcon, setLucideIcon] = useState<LucideIcon | null>(null)
  useEffect(() => {
    if (group.iconSource === 'library' && group.icon) {
      loadLucideIcon(group.icon).then(setLucideIcon)
    } else {
      setLucideIcon(null)
    }
  }, [group.icon, group.iconSource])

  if (group.iconSource === 'library') {
    if (!lucideIcon) return null
    const Icon = lucideIcon
    const style = group.iconColor ? { color: group.iconColor } : undefined
    return <Icon size={27} strokeWidth={1.75} className={group.iconColor ? 'shrink-0' : 'text-text-secondary shrink-0'} style={style} />
  }
  if (group.iconSource === 'emoji') {
    return <span className="text-[27px] leading-none shrink-0">{group.icon}</span>
  }
  // custom / favicon - local file
  return (
    <img
      src={`command-center-asset://${group.icon}`}
      className="w-7 h-7 object-contain rounded-sm shrink-0"
      alt=""
    />
  )
}

interface GroupPageProps {
  groupId: string
  groups:  Group[]
}

export default function GroupPage({ groupId, groups }: GroupPageProps) {
  const { cards, loadCards, createCard, updateCard, deleteCard, reorderCards } = useCards()

  const group = groups.find(g => g.id === groupId)

  // Load cards whenever the active group changes
  useEffect(() => {
    if (groupId) loadCards(groupId).catch(console.error)
  }, [groupId, loadCards])

  async function handleAddCard(gId: string, name: string) {
    await createCard({ groupId: gId, name, icon: '' })
  }

  async function handleRenameCard(id: string, name: string) {
    await updateCard({ id, name })
  }

  if (!group) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-text-muted text-sm">Group not found</span>
      </div>
    )
  }

  return (
    <div
      className="h-full flex flex-col"
      style={{ '--accent': group.accentColor } as React.CSSProperties}
    >
      {/* Group header */}
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-surface-4">
        {group.icon && <GroupHeaderIcon group={group} />}
        <h1 className="text-text-primary font-semibold text-base">{group.name}</h1>
        <span className="text-text-muted text-xs ml-1">{cards.length} card{cards.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Card grid */}
      <div className="flex-1 overflow-y-auto">
        <CardGrid
          cards={cards}
          groupId={groupId}
          accentColor={group.accentColor}
          onRenameCard={handleRenameCard}
          onDeleteCard={(id) => deleteCard(id)}
          onAddCard={handleAddCard}
          onReorderCards={reorderCards}
        />
      </div>
    </div>
  )
}
