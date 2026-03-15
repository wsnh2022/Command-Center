// @see ActionDefs.tsx for ACTION_DEFS
/**
 * ItemIcons.tsx
 * Icon registry for item types and context menu.
 * ACTION_DEFS lives in ActionDefs.tsx — imported lazily by ItemFormPanel only.
 * lucide-react v0.378.0
 */
import {
  Globe, Zap, Folder, Terminal, Cpu,
  Monitor, Pencil, Copy, ArrowRight, Trash2, LayoutGrid,
  CheckSquare,
  type LucideIcon,
} from 'lucide-react'
import type { ItemType } from '../../types'

// ─── Per-type accent colors — readable on dark (#1e2536) and light (#f0f2f8) ─
const TYPE_COLOR: Record<ItemType, string> = {
  url:      'text-sky-400',
  software: 'text-amber-400',
  folder:   'text-yellow-500',
  command:  'text-emerald-400',
  action:   'text-violet-400',
}

interface TypeIconProps {
  type:       ItemType
  size?:      number
  className?: string   // override color
}

/** Renders the Lucide icon for an item type with its accent color. */
export function ItemTypeIcon({ type, size = 14, className }: TypeIconProps) {
  const color = className ?? TYPE_COLOR[type] ?? 'text-text-muted'
  const p = { size, className: color, strokeWidth: 1.75 }
  switch (type) {
    case 'url':      return <Globe    {...p} />
    case 'software': return <Zap      {...p} />
    case 'folder':   return <Folder   {...p} />
    case 'command':  return <Terminal {...p} />
    case 'action':   return <Cpu      {...p} />
    default:         return <LayoutGrid {...p} />
  }
}

// ─── Type selector defs (used in ItemFormPanel type tab row) ─────────────────
export interface ItemTypeDef {
  value: ItemType
  label: string
  Icon:  LucideIcon
  color: string
}

export const ITEM_TYPE_DEFS: ItemTypeDef[] = [
  { value: 'url',      label: 'URL',      Icon: Globe,    color: 'text-sky-400'    },
  { value: 'software', label: 'Open File', Icon: Zap,      color: 'text-amber-400'  },
  { value: 'folder',   label: 'Folder',   Icon: Folder,   color: 'text-yellow-500' },
  { value: 'command',  label: 'Command',  Icon: Terminal, color: 'text-emerald-400'},
  { value: 'action',   label: 'Action',   Icon: Cpu,      color: 'text-violet-400' },
]

// ─── Context menu action icons — use text-text-secondary (shifts with theme) ─
export const CtxIcon = {
  Webview: () => <Monitor    size={13} className="text-text-secondary" strokeWidth={1.75} />,
  Edit:    () => <Pencil     size={13} className="text-text-secondary" strokeWidth={1.75} />,
  Copy:    () => <Copy       size={13} className="text-text-secondary" strokeWidth={1.75} />,
  Move:    () => <ArrowRight size={13} className="text-text-secondary" strokeWidth={1.75} />,
  Select:  () => <CheckSquare size={13} className="text-text-secondary" strokeWidth={1.75} />,
  Delete:  () => <Trash2     size={13} className="text-danger"         strokeWidth={1.75} />,
} as const
