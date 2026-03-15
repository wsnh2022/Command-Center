import { Plus } from 'lucide-react'

interface AddItemButtonProps {
  onClick: () => void
}

export default function AddItemButton({ onClick }: AddItemButtonProps) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-1.5 px-2 h-7 rounded-btn text-xs text-text-muted hover:text-text-primary hover:bg-surface-3 transition-base duration-base"
    >
      <Plus size={12} />
      Add Item
    </button>
  )
}
