import { Home, Settings, LayoutGrid, ArrowDownUp, Keyboard, Info } from 'lucide-react'
import GroupPillList from '../groups/GroupPillList'
import type { Group } from '../../types'
import type { ActivePage, NavigateFn } from '../../types/navigation'

interface SidebarProps {
  groups:        Group[]
  activePage:    ActivePage
  navigate:      NavigateFn
  onReorder:     (orderedIds: string[]) => Promise<void>
  onAddGroup:    () => void
  onEditGroup:   (group: Group) => void
  onDeleteGroup: (id: string) => void
}

const PAGE_ICONS = [
  { type: 'settings'       as const, icon: Settings,    label: 'Settings'      },
  { type: 'group-manager'  as const, icon: LayoutGrid,  label: 'Group Manager' },
  { type: 'import-export'  as const, icon: ArrowDownUp, label: 'Import/Export' },
  { type: 'shortcuts'      as const, icon: Keyboard,    label: 'Shortcuts'     },
  { type: 'about'          as const, icon: Info,        label: 'About'         },
]

export default function Sidebar({ groups, activePage, navigate, onReorder, onAddGroup, onEditGroup, onDeleteGroup }: SidebarProps) {
  const isPageActive = (type: string) => activePage.type === type

  return (
    <aside
      className="flex flex-col h-full bg-surface-1"
      style={{ width: '224px', minWidth: '224px' }}
    >

      {/* App name header
          - border-b removed — no dividing line below the logo area
          - height bumped to 72px to accommodate the larger text
          - "Command" at 26px — the visual anchor
          - "CENTER" stays small + tracked — typographic subtitle, not scaled up
      */}
      <div
        className="flex items-center gap-3 px-4 shrink-0"
        style={{ height: '72px' }}
      >
        <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shadow-sm shrink-0">
          <span className="text-text-inverse text-xs font-black tracking-tight">CC</span>
        </div>
        <div className="flex flex-col gap-1 leading-none">
          <span className="text-text-primary font-bold text-[26px] tracking-tight leading-none">Command</span>
          <span className="text-accent text-[11px] font-semibold tracking-widest uppercase">Center</span>
        </div>
      </div>

      {/* Home — prominent anchor, top of nav */}
      <div className="px-2 pt-2 pb-1 shrink-0">
        <button
          onClick={() => navigate({ type: 'home' })}
          className={[
            'w-full flex items-center gap-2.5 px-3 h-10 rounded-btn text-sm font-medium transition-base duration-base',
            isPageActive('home')
              ? 'bg-accent text-white shadow-sm'
              : 'text-text-secondary hover:bg-surface-3 hover:text-text-primary',
          ].join(' ')}
        >
          <Home size={16} className={isPageActive('home') ? 'text-white' : 'text-text-muted'} />
          <span>Home</span>
        </button>
      </div>


      {/* Groups label */}
      <div className="px-4 pt-2 pb-1 shrink-0">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">Groups</span>
      </div>

      {/* Group pills — scrollable, drag-reorderable */}
      <div className="flex-1 overflow-y-auto px-2 min-h-0">
        <GroupPillList
          groups={groups}
          activePage={activePage}
          navigate={navigate}
          onReorder={onReorder}
          onAddGroup={onAddGroup}
          onEditGroup={onEditGroup}
          onDeleteGroup={onDeleteGroup}
        />
      </div>

      {/* Page icon bar */}
      <div className="shrink-0 border-t border-surface-2">
        <div className="flex items-center justify-around px-3 py-2">
          {PAGE_ICONS.map(({ type, icon: Icon, label }) => (
            <button
              key={type}
              title={label}
              aria-label={label}
              onClick={() => navigate({ type })}
              className={[
                'w-8 h-8 flex items-center justify-center rounded-btn transition-base duration-base',
                isPageActive(type)
                  ? 'text-accent bg-accent-soft'
                  : 'text-text-muted hover:text-text-primary hover:bg-surface-3',
              ].join(' ')}
            >
              <Icon size={24} />
            </button>
          ))}
        </div>
      </div>
    </aside>
  )
}
