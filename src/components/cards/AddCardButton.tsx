import { useState } from 'react'
import { Plus, X, Check } from 'lucide-react'

interface AddCardButtonProps {
  groupId: string
  onAdd:   (groupId: string, name: string) => Promise<void>
}

export default function AddCardButton({ groupId, onAdd }: AddCardButtonProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleAdd() {
    const trimmed = name.trim()
    if (!trimmed) return
    setBusy(true)
    try {
      await onAdd(groupId, trimmed)
      setName(''); setOpen(false)
    } catch (e) { console.error(e) }
    finally { setBusy(false) }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 h-8 rounded-btn text-xs text-text-muted hover:text-text-primary hover:bg-surface-3 transition-base duration-base border border-dashed border-surface-4"
      >
        <Plus size={13} /> Add Card
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        autoFocus
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter')  handleAdd()
          if (e.key === 'Escape') { setOpen(false); setName('') }
        }}
        placeholder="Card name…"
        maxLength={64}
        className="h-8 px-3 text-xs bg-surface-3 rounded-input border border-accent text-text-primary placeholder:text-text-muted outline-none"
        style={{ width: '160px' }}
      />
      <button
        onClick={handleAdd}
        disabled={busy || !name.trim()}
        className="w-8 h-8 flex items-center justify-center rounded-btn text-text-inverse transition-base duration-base disabled:opacity-50"
        style={{ backgroundColor: 'var(--accent)' }}
      >
        <Check size={13} />
      </button>
      <button
        onClick={() => { setOpen(false); setName('') }}
        className="w-8 h-8 flex items-center justify-center rounded-btn text-text-muted hover:text-text-primary hover:bg-surface-3 transition-base duration-base"
      >
        <X size={13} />
      </button>
    </div>
  )
}
