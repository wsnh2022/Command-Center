// Shared TypeScript interfaces — used by both main process and renderer.
// Source of truth: docs/DATABASE_SCHEMA.md §6

export type ItemType   = 'url' | 'software' | 'folder' | 'command' | 'action'
export type Theme      = 'dark' | 'light'
export type FontSize   = 'small' | 'medium' | 'large'
export type Density    = 'compact' | 'comfortable'
export type IconSource = 'auto' | 'favicon' | 'custom' | 'emoji' | 'library'

// All predefined Windows action keys for the Action item type.
// 10 survivors after removing generic/redundant actions (Session 27).
// Full power-user list replaces these in Session 28.
export type ActionId =
  | 'screenshot'     | 'lock_screen'    | 'sleep'
  | 'shut_down'      | 'restart'        | 'task_manager'
  | 'calculator'     | 'empty_recycle_bin'
  | 'clipboard'      | 'run'
  | 'custom'         // user-defined — shell cmd stored in `path`

export interface Group {
  id:          string
  name:        string
  icon:        string
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
  // action-type extras
  actionId:     string       // ActionId key, or '' for non-action types
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
  actionId?:    string    // action type — ActionId key or 'custom'
  iconColor?:   string    // library icons only — hex colour or '' for default
}

export interface UpdateItemInput extends Partial<Omit<CreateItemInput, 'cardId'>> {
  id:         string
  sortOrder?: number
}
