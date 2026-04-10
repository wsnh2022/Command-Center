// Routing state type - state-based routing, no react-router (see ARCHITECTURE.md decision #4)
export type ActivePage =
  | { type: 'home' }
  | { type: 'group'; groupId: string }
  | { type: 'settings' }
  | { type: 'group-manager' }
  | { type: 'import-export' }
  | { type: 'shortcuts' }
  | { type: 'about' }

export type NavigateFn = (page: ActivePage) => void
