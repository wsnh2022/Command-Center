import type { Group } from '../../types'
import type { ActivePage, NavigateFn } from '../../types/navigation'
import type { WebviewControls } from '../../hooks/useWebview'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import WebviewPanel from './WebviewPanel'

interface AppShellProps {
  groups:        Group[]
  activePage:    ActivePage
  navigate:      NavigateFn
  onReorder:     (orderedIds: string[]) => Promise<void>
  onAddGroup:    () => void
  onEditGroup:   (group: Group) => void
  onDeleteGroup: (id: string) => void
  webview:       WebviewControls
  children:      React.ReactNode
}

// Root layout: sidebar (fixed left) + centre column (topbar + main) + webview panel (right, conditional)
export default function AppShell({
  groups, activePage, navigate, onReorder, onAddGroup, onEditGroup, onDeleteGroup,
  webview, children,
}: AppShellProps) {
  const isBottom = webview.isOpen && webview.position === 'bottom'
  const isRight  = webview.isOpen && webview.position === 'right'

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-surface-0">
      {/* Top section: sidebar + content + optional right panel */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
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

        {/* Right: webview panel — third column, right mode only */}
        {isRight && (
          <WebviewPanel
            position="right"
            currentUrl={webview.currentUrl}
            size={webview.panelWidth}
            onBack={webview.back}
            onForward={webview.forward}
            onReload={webview.reload}
            onEject={webview.eject}
            onClose={webview.close}
            onNavigate={webview.navigate}
            onResize={webview.resize}
          />
        )}
      </div>

      {/* Bottom: webview panel — full-width row, bottom mode only */}
      {isBottom && (
        <WebviewPanel
          position="bottom"
          currentUrl={webview.currentUrl}
          size={webview.panelHeight}
          onBack={webview.back}
          onForward={webview.forward}
          onReload={webview.reload}
          onEject={webview.eject}
          onClose={webview.close}
          onNavigate={webview.navigate}
          onResize={webview.resize}
        />
      )}
    </div>
  )
}
