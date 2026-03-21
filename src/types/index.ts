// Shared TypeScript interfaces — used by both main process and renderer.
// Source of truth: docs/DATABASE_SCHEMA.md §6

export type ItemType   = 'url' | 'software' | 'folder' | 'command'
export type Theme      = 'dark' | 'light'
export type FontSize   = 'medium' | 'large'
export type Density    = 'compact' | 'comfortable'
export type IconSource = 'auto' | 'favicon' | 'custom' | 'url-icon' | 'b64-icon' | 'emoji' | 'library'

export interface Group {
  id:          string
  name:        string
  icon:        string
  iconSource:  IconSource
  iconColor:   string
  accentColor: string
  sortOrder:   number
  createdAt:   string
  updatedAt:   string
}

export interface Card {
  id:        string
  groupId:   string
  name:      string
  icon:      string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface Item {
  id:           string
  cardId:       string
  label:        string
  path:         string       // URL / exe path / folder / command name / custom shell cmd
  type:         ItemType
  iconPath:     string
  iconSource:   IconSource
  note:         string
  tags:         string[]     // resolved from item_tags join
  // command-type extras
  commandArgs:  string       // CLI arguments (e.g. -NoProfile -Command "...") — '' for other types
  workingDir:   string       // Working directory — '' means default (Documents)
  // retained for DB compatibility — always '' for new items (action type removed)
  actionId:     string
  // icon colour (library source only)
  iconColor:    string       // hex e.g. '#6366f1' or '' (falls back to text-text-secondary)
  sortOrder:    number
  launchCount:  number
  createdAt:    string
  updatedAt:    string
}

export interface Tag {
  id:   string
  name: string
}

export interface RecentItem {
  id:         string
  itemId:     string
  item:       Item
  launchedAt: string
}

export interface FavoriteItem {
  id:        string
  itemId:    string
  item:      Item
  sortOrder: number
  pinnedAt:  string
}

export interface AppSettings {
  theme:            Theme
  fontSize:         FontSize
  density:          Density
  launchOnStartup:  boolean
  minimizeToTray:   boolean
  webviewPosition:  'right' | 'bottom'
  webviewWidth:     number
  lastActiveGroup:  string
  globalShortcut:   string   // accelerator string e.g. 'CommandOrControl+Shift+Space'
  hoverNavigate:    boolean  // hover sidebar group pill for 300ms to navigate
  updatedAt:        string
}

export interface SearchIndexEntry {
  itemId:    string
  label:     string
  path:      string
  type:      ItemType    // added for icon rendering in search results
  note:      string
  tags:      string[]
  cardId:    string
  cardName:  string
  groupId:   string
  groupName: string
}

// ---- IPC Input Types ----

export interface CreateGroupInput {
  name:        string
  icon:        string
  iconSource?: IconSource
  iconColor?:  string
  accentColor: string
}

export interface UpdateGroupInput extends Partial<CreateGroupInput> {
  id:         string
  sortOrder?: number
}

export interface CreateCardInput {
  groupId: string
  name:    string
  icon:    string
}

export interface UpdateCardInput extends Partial<Omit<CreateCardInput, 'groupId'>> {
  id:         string
  sortOrder?: number
}

export interface CreateItemInput {
  cardId:       string
  label:        string
  path:         string
  type:         ItemType
  iconPath?:    string
  iconSource?:  IconSource
  note?:        string
  tags?:        string[]
  commandArgs?: string    // command type — CLI arguments
  workingDir?:  string    // command type — working directory ('' = default)
  iconColor?:   string    // library icons only — hex colour or '' for default
}

export interface UpdateItemInput extends Partial<Omit<CreateItemInput, 'cardId'>> {
  id:         string
  sortOrder?: number
}
