import type { Group } from '../../types'
import type { ActivePage, NavigateFn } from '../../types/navigation'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

interface AppShellProps {
  groups:        Group[]
  activePage:    ActivePage
  navigate:      NavigateFn
  onReorder:     (orderedIds: string[]) => Promise<void>
  onAddGroup:    () => void
  onEditGroup:   (group: Group) => void
  onDeleteGroup: (id: string) => void
  children:      React.ReactNode
}

// Root layout: fixed sidebar (left) + centre column (topbar + scrollable main)
export default function AppShell({
  groups, activePage, navigate, onReorder, onAddGroup, onEditGroup, onDeleteGroup, children,
}: AppShellProps) {
  return (
    <div className="flex h-full w-full overflow-hidden bg-surface-0">
      {/* Left: fixed sidebar */}
      <Sidebar
        groups={groups}
        activePage={activePage}
        navigate={navigate}
        onReorder={onReorder}
        onAddGroup={onAddGroup}
        onEditGroup={onEditGroup}
        onDeleteGroup={onDeleteGroup}
      />

      {/* Centre: topbar + scrollable main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar navigate={navigate} />
        <main className="flex-1 overflow-y-auto bg-surface-0 p-4">
          {children}
        </main>
      </div>
    </div>
  )
}
