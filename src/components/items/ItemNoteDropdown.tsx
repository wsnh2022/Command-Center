import type { Item } from '../../types'

const WORD_LIMIT = 450

interface ItemNoteContentProps {
  item: Item
}

// Renders note body + tags — toggle is handled by ItemRow chevron
export default function ItemNoteContent({ item }: ItemNoteContentProps) {
  const hasNote = item.note && item.note.trim().length > 0
  const hasTags = item.tags && item.tags.length > 0

  if (!hasNote && !hasTags) return null

  return (
    <div className="px-4 pb-2 flex flex-col gap-1.5">
      {hasNote && (
        <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap">
          {item.note}
        </p>
      )}
      {hasTags && (
        <div className="flex flex-wrap gap-1">
          {item.tags.map(tag => (
            <span
              key={tag}
              className="px-1.5 py-0.5 rounded-pill text-xs bg-accent-soft text-accent"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export { WORD_LIMIT }
