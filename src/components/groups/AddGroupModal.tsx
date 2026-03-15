import { useState, useEffect, useRef } from 'react'
import { X, ImageIcon } from 'lucide-react'
import ColorPicker from './ColorPicker'
import GroupIconPicker from './GroupIconPicker'
import { loadLucideIcon } from '../../utils/lucide-registry'
import type { LucideIcon } from 'lucide-react'
import type { CreateGroupInput, UpdateGroupInput, Group } from '../../types'

interface AddGroupModalProps {
  onClose:   () => void
  onCreate?: (input: CreateGroupInput) => Promise<void>
  onUpdate?: (input: UpdateGroupInput) => Promise<void>
  editing?:  Group
}

const DEFAULT_COLOR = '#3b82f6'

/** Renders a Lucide icon by name; returns null while loading */
function InlineIcon({ name, size }: { name: string; size: number }) {
  const [icon, setIcon] = useState<LucideIcon | null>(null)
  useEffect(() => { loadLucideIcon(name).then(setIcon) }, [name])
  if (!icon) return null
  const Icon = icon
  return <Icon size={size} strokeWidth={1.75} />
}

export default function AddGroupModal({ onClose, onCreate, onUpdate, editing }: AddGroupModalProps) {
  const [name,           setName]           = useState(editing?.name        ?? '')
  const [icon,           setIcon]           = useState(editing?.icon        ?? '')
  const [color,          setColor]          = useState(editing?.accentColor ?? DEFAULT_COLOR)
  const [busy,           setBusy]           = useState(false)
  const [error,          setError]          = useState('')
  const [showIconPicker, setShowIconPicker] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => { nameRef.current?.focus() }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape' && !showIconPicker) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, showIconPicker])

  async function handleSubmit() {
    const trimmed = name.trim()
    if (!trimmed) { setError('Name is required'); return }
    setBusy(true); setError('')
    try {
      if (editing && onUpdate) {
        await onUpdate({ id: editing.id, name: trimmed, icon, accentColor: color })
      } else if (onCreate) {
        await onCreate({ name: trimmed, icon, accentColor: color })
      }
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        onClick={e => { if (e.target === e.currentTarget) onClose() }}
      >
        <div className="bg-surface-2 rounded-modal shadow-modal w-96 flex flex-col" style={{ border: '1px solid var(--surface-4)' }}>

          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-4">
            <h2 className="text-text-primary font-semibold text-sm">{editing ? 'Edit Group' : 'New Group'}</h2>
            <button
              onClick={onClose}
              className="w-6 h-6 flex items-center justify-center rounded-btn text-text-muted hover:text-text-primary hover:bg-surface-3 transition-base duration-base"
            >
              <X size={14} />
            </button>
          </div>

          <div className="px-5 pb-5 flex flex-col gap-4">

            {/* Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-text-secondary font-medium">Name</label>
              <input
                ref={nameRef}
                type="text"
                value={name}
                onChange={e => { setName(e.target.value); setError('') }}
                onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
                placeholder="e.g. Work, Dev Tools…"
                maxLength={64}
                className="h-8 px-3 text-sm bg-surface-3 rounded-input border border-surface-4 text-text-primary placeholder:text-text-muted outline-none focus:border-accent transition-base duration-base"
              />
              {error && <span className="text-xs text-danger">{error}</span>}
            </div>

            {/* Icon — library picker trigger */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-text-secondary font-medium">Icon</label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowIconPicker(true)}
                  className={[
                    'w-9 h-9 flex items-center justify-center rounded-btn border transition-base duration-base',
                    icon
                      ? 'bg-accent-soft border-accent text-text-primary'
                      : 'bg-surface-3 border-surface-4 text-text-muted hover:text-text-primary hover:border-accent',
                  ].join(' ')}
                  title="Choose icon from library"
                >
                  {icon
                    ? <InlineIcon name={icon} size={18} />
                    : <ImageIcon size={16} />
                  }
                </button>
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-text-secondary">
                    {icon ? icon : 'No icon selected'}
                  </span>
                  {icon && (
                    <button
                      onClick={() => setIcon('')}
                      className="text-[11px] text-text-muted hover:text-danger transition-base duration-base text-left"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Accent Color */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-text-secondary font-medium">Accent Color</label>
              <ColorPicker value={color} onChange={setColor} />
            </div>

            {/* Preview */}
            <div className="flex items-center gap-2 py-1">
              <span className="text-xs text-text-muted">Preview:</span>
              <div
                className="flex items-center gap-2 px-3 h-9 rounded-btn text-sm"
                style={{ backgroundColor: `${color}26`, borderLeft: `2px solid ${color}`, color: 'var(--text-primary)' }}
              >
                {icon && (
                  <span className="shrink-0 text-text-primary">
                    <InlineIcon name={icon} size={15} />
                  </span>
                )}
                <span>{name || 'Group Name'}</span>
              </div>
            </div>

          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-5 pb-5">
            <button
              onClick={onClose}
              className="h-8 px-4 text-sm rounded-btn text-text-secondary hover:text-text-primary hover:bg-surface-3 transition-base duration-base"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={busy}
              className="h-8 px-4 text-sm rounded-btn font-medium text-text-inverse transition-base duration-base disabled:opacity-50"
              style={{ backgroundColor: color }}
            >
              {busy ? 'Saving…' : editing ? 'Save Changes' : 'Create Group'}
            </button>
          </div>

        </div>
      </div>

      {/* Library icon picker — z-[60] so it layers above this modal */}
      {showIconPicker && (
        <GroupIconPicker
          current={icon}
          onSelect={name => setIcon(name)}
          onClose={() => setShowIconPicker(false)}
        />
      )}
    </>
  )
}
