import { useState } from 'react'
import { SettingsProvider } from './context/SettingsContext'
import { ThemeProvider } from './context/ThemeContext'
import { FavoritesProvider } from './context/FavoritesContext'
import AppShell from './components/layout/AppShell'
import AddGroupModal from './components/groups/AddGroupModal'
import HomePage from './pages/HomePage'
import GroupPage from './pages/GroupPage'
import SettingsPage from './pages/SettingsPage'
import GroupManagerPage from './pages/GroupManagerPage'
import ImportExportPage from './pages/ImportExportPage'
import ShortcutsPage from './pages/ShortcutsPage'
import AboutPage from './pages/AboutPage'
import { useGroups } from './hooks/useGroups'
import { useWebview } from './hooks/useWebview'
import type { ActivePage, NavigateFn } from './types/navigation'
import type { CreateGroupInput, UpdateGroupInput, Group } from './types'

function AppInner() {
  const { groups, createGroup, updateGroup, deleteGroup, reorderGroups } = useGroups()
  const webview = useWebview()



  const [activePage, setActivePage] = useState<ActivePage>({ type: 'home' })
  const [showAddGroup, setShowAddGroup] = useState(false)
  const [editingGroup, setEditingGroup] = useState<Group | null>(null)

  const navigate: NavigateFn = (page) => setActivePage(page)

  async function handleCreateGroup(input: CreateGroupInput) {
    const group = await createGroup(input)
    navigate({ type: 'group', groupId: group.id })
  }

  function handleEditGroup(group: Group) {
    setEditingGroup(group)
    setShowAddGroup(true)
  }

  // Used by sidebar delete — navigates home after deletion
  function handleDeleteGroup(id: string) {
    deleteGroup(id)
    navigate({ type: 'home' })
  }

  function closeGroupModal() {
    setShowAddGroup(false)
    setEditingGroup(null)
  }

  function renderPage() {
    switch (activePage.type) {
      case 'home': return <HomePage />
      case 'group': return <GroupPage groupId={activePage.groupId} groups={groups} />
      case 'settings': return <SettingsPage navigate={navigate} />
      case 'group-manager': return (
        <GroupManagerPage
          groups={groups}
          onUpdateGroup={updateGroup}
          onDeleteGroup={deleteGroup}
          onReorderGroups={reorderGroups}
          navigate={navigate}
        />
      )
      case 'import-export': return <ImportExportPage />
      case 'shortcuts': return <ShortcutsPage />
      case 'about': return <AboutPage />
    }
  }

  return (
    <>
      <AppShell
        groups={groups}
        activePage={activePage}
        navigate={navigate}
        onReorder={reorderGroups}
        onAddGroup={() => { setEditingGroup(null); setShowAddGroup(true) }}
        onEditGroup={handleEditGroup}
        onDeleteGroup={handleDeleteGroup}
        webview={webview}
      >
        {renderPage()}
      </AppShell>

      {showAddGroup && (
        <AddGroupModal
          onClose={closeGroupModal}
          onCreate={editingGroup ? undefined : handleCreateGroup}
          onUpdate={editingGroup ? (input: UpdateGroupInput) => updateGroup(input).then(closeGroupModal) : undefined}
          editing={editingGroup ?? undefined}
        />
      )}
    </>
  )
}

export default function App() {
  return (
    <SettingsProvider>
      <ThemeProvider>
        <FavoritesProvider>
          <AppInner />
        </FavoritesProvider>
      </ThemeProvider>
    </SettingsProvider>
  )
}
