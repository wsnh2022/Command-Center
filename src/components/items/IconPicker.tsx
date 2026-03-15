/**
 * IconPicker.tsx
 * Modal for selecting an icon — 6 tabs per ICON_SYSTEM.md §5.
 *
 * Tabs: Auto | Emoji | Library | Upload | URL | Base64
 *
 * On confirm: calls onSelect({ iconPath, iconSource }) — caller updates item state.
 * On cancel:  calls onClose() — no disk writes occur.
 *
 * All disk writes happen only when user clicks "Use Icon".
 * Preview (URL / upload) fetches/reads to memory only.
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { X, RefreshCw, Upload, Link, Code, Smile, Library } from 'lucide-react'
import dynamicIconImports from 'lucide-react/dynamicIconImports'
import { loadLucideIcon } from '../../utils/lucide-registry'
import type { LucideIcon } from 'lucide-react'
import { ipc } from '../../utils/ipc'
import type { IconSource, ItemType } from '../../types'

export interface IconSelection {
  iconPath:    string
  iconSource:  IconSource
  previewUri?: string   // base64 data URI for upload/url/base64 — used in form preview before save
  iconColor?:  string   // library only — hex colour e.g. '#6366f1', or '' for default
}

interface IconPickerProps {
  currentIconPath:   string
  currentIconSource: IconSource
  currentIconColor?: string   // seeds the colour picker when editing an existing library icon
  itemType:          ItemType
  itemUrl?:          string   // needed for Auto tab re-fetch
  onSelect:          (selection: IconSelection) => void
  onClose:           () => void
}

type TabId = 'auto' | 'emoji' | 'library' | 'upload' | 'url' | 'base64'

// ─── Full icon name list derived from dynamicIconImports ────────────────────
// Converts kebab-case keys ('git-branch') to PascalCase ('GitBranch').
// Computed once at module load — no network, no async, no maintenance.
function kebabToPascal(kebab: string): string {
  return kebab.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')
}

// All 1460 PascalCase icon names from lucide-react v0.378.0.
// Derived from the real dynamicIconImports keys — no regex toKebab conversion,
// so all 8 edge-case icons (ArrowDown01, Grid2x2, etc.) resolve correctly.
const ALL_ICON_NAMES: string[] = Object.keys(dynamicIconImports).map(kebabToPascal)

// All icons shown by default.
const DEFAULT_ICONS = ALL_ICON_NAMES

// Max results when user is searching
const SEARCH_LIMIT = 200

// Virtual scroll constants
const COLS        = 10          // must match gridTemplateColumns repeat()
const CELL_SIZE   = 40          // px — w-9 (36) + gap-1 (4)
const BUFFER_ROWS = 4           // extra rows rendered above + below viewport

// ─── Emoji dataset ────────────────────────────────────────────────────────────
// Grouped by category — common emoji for a productivity launcher context
const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  { label: 'Common', emojis: ['⭐','🔥','✅','❌','⚡','🎯','🚀','💡','🔑','🛡️','📌','🔔','💬','📧','🗂️','📁','📂','💾','🖥️','⌨️','🖱️','🖨️'] },
  { label: 'Dev',    emojis: ['💻','🖥️','⌨️','🖱️','🔧','🔩','⚙️','🛠️','🔬','🧪','🧬','📡','📟','💡','🔌','🔋','💿','📀','🗜️'] },
  { label: 'Work',   emojis: ['📋','📊','📈','📉','🗒️','📝','✏️','🖊️','📎','📐','📏','🗓️','📅','📆','📌','📍','🗃️','🗄️','🗑️'] },
  { label: 'Media',  emojis: ['🎵','🎶','🎬','🎥','📷','📸','📹','🎙️','🎚️','🎛️','🎤','🎧','🎼','🎞️','📻','📺','🎮','🕹️'] },
  { label: 'Travel', emojis: ['🌍','🌎','🌏','🗺️','🏠','🏢','🏗️','🏭','✈️','🚂','🚗','⛵','🚁','🛸','⛺','🌄','🌆','🌃'] },
  { label: 'Nature', emojis: ['🌿','🌱','🌲','🌳','🌴','🌸','🌺','🌻','🌼','🍀','🍁','🍂','🌙','⭐','☀️','⛅','🌈','❄️','🔥','💧'] },
]

// ─── Preview box ──────────────────────────────────────────────────────────────

interface PreviewBoxProps {
  iconPath:    string
  iconSource:  IconSource
  previewUri?: string   // base64 data URI (for URL/upload preview before save)
  iconColor?:  string   // applied to library icon preview
}

function PreviewBox({ iconPath, iconSource, previewUri, iconColor }: PreviewBoxProps) {
  const src = previewUri ?? (iconPath ? `command-center-asset://${iconPath}` : '')

  return (
    <div className="flex items-center justify-center w-16 h-16 rounded-lg bg-surface-3 border border-surface-4 mx-auto shrink-0">
      {iconSource === 'emoji' && iconPath ? (
        <span className="text-3xl leading-none">{iconPath}</span>
      ) : iconSource === 'library' && iconPath ? (
        <LibraryIconPreview name={iconPath} size={32} color={iconColor} />
      ) : src ? (
        <img src={src} alt="icon preview" className="w-10 h-10 object-contain" />
      ) : (
        <span className="text-text-muted text-xs text-center px-1">No icon</span>
      )}
    </div>
  )
}

function LibraryIconPreview({ name, size, color }: { name: string; size: number; color?: string }) {
  const [icon, setIcon] = useState<LucideIcon | null>(null)
  useEffect(() => {
    if (!name) return
    loadLucideIcon(name).then(setIcon)
  }, [name])
  if (!icon) return <span className="text-text-muted text-xs">{name}</span>
  const Icon = icon
  // Apply stored colour as inline style if set; otherwise fall back to CSS class
  const style = color ? { color } : undefined
  const cls   = color ? undefined : 'text-text-secondary'
  return <Icon size={size} className={cls} style={style} strokeWidth={1.5} />
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function IconPicker({
  currentIconPath, currentIconSource, currentIconColor, itemType, itemUrl, onSelect, onClose,
}: IconPickerProps) {
  const [activeTab, setActiveTab] = useState<TabId>('auto')

  // Pending selection — not committed until "Use Icon" is clicked
  const [pendingPath,   setPendingPath]   = useState(currentIconPath)
  const [pendingSource, setPendingSource] = useState<IconSource>(currentIconSource)
  const [previewUri,    setPreviewUri]    = useState<string | undefined>(undefined)
  const [pendingColor,  setPendingColor]  = useState(currentIconColor ?? '')   // seeded from item on edit
  // Pre-mark as selected if editing an existing library icon — user can re-confirm without
  // having to re-pick the icon just to change the colour.
  const [hasSelection,  setHasSelection]  = useState(
    currentIconSource === 'library' && !!currentIconPath
  )
  const [busy,          setBusy]          = useState(false)
  const [error,         setError]         = useState('')

  function markSelected(path: string, source: IconSource, preview?: string) {
    setPendingPath(path)
    setPendingSource(source)
    setPreviewUri(preview)
    // Clear colour when switching away from library
    if (source !== 'library') setPendingColor('')
    setHasSelection(true)
    setError('')
  }

  async function handleConfirm() {
    if (!hasSelection) { onClose(); return }
    setBusy(true)
    setError('')
    try {
      onSelect({
        iconPath:   pendingPath,
        iconSource: pendingSource,
        previewUri,
        iconColor:  pendingSource === 'library' ? pendingColor : '',
      })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to apply icon')
    } finally { setBusy(false) }
  }

  const TABS: { id: TabId; label: string; Icon: React.FC<{ size: number; className: string }> }[] = [
    { id: 'auto',    label: 'Auto',    Icon: (p) => <RefreshCw  {...p} /> },
    { id: 'emoji',   label: 'Emoji',   Icon: (p) => <Smile      {...p} /> },
    { id: 'library', label: 'Library', Icon: (p) => <Library    {...p} /> },
    { id: 'upload',  label: 'Upload',  Icon: (p) => <Upload     {...p} /> },
    { id: 'url',     label: 'URL',     Icon: (p) => <Link       {...p} /> },
    { id: 'base64',  label: 'Base64',  Icon: (p) => <Code       {...p} /> },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-surface-2 rounded-lg shadow-panel border border-surface-4 flex flex-col"
        style={{ width: 480, maxHeight: '80vh' }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-4 shrink-0">
          <h2 className="text-sm font-semibold text-text-primary">Choose Icon</h2>
          <button onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-btn text-text-muted hover:text-text-primary hover:bg-surface-3 transition-base duration-base">
            <X size={14} />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-surface-4 shrink-0 px-3 pt-2 gap-0.5">
          {TABS.map(t => (
            <button key={t.id} onClick={() => { setActiveTab(t.id); setError('') }}
              className={[
                'px-3 h-8 rounded-t-btn text-xs transition-base duration-base border-b-2 whitespace-nowrap',
                activeTab === t.id
                  ? 'text-text-primary border-accent'
                  : 'text-text-secondary border-transparent hover:text-text-primary hover:bg-surface-3',
              ].join(' ')}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4 min-h-0">

          {/* Live preview */}
          <PreviewBox iconPath={pendingPath} iconSource={pendingSource} previewUri={previewUri} iconColor={pendingColor} />

          {error && (
            <div className="px-3 py-2 rounded-input bg-danger/10 text-danger text-xs">{error}</div>
          )}

          {/* Tab content */}
          {activeTab === 'auto' && (
            <AutoTab itemType={itemType} itemUrl={itemUrl}
              onSelect={(path, src) => markSelected(path, src)} setError={setError} setBusy={setBusy} />
          )}
          {activeTab === 'emoji' && (
            <EmojiTab onSelect={(emoji) => markSelected(emoji, 'emoji')} />
          )}
          {activeTab === 'library' && (
            <LibraryTab
              onSelect={(name) => markSelected(name, 'library')}
              selected={pendingSource === 'library' ? pendingPath : ''}
              color={pendingColor}
              onColorChange={(c) => { setPendingColor(c); setHasSelection(true) }}
            />
          )}
          {activeTab === 'upload' && (
            <UploadTab onSelect={markSelected} setError={setError} />
          )}
          {activeTab === 'url' && (
            <UrlTab onSelect={markSelected} setError={setError} />
          )}
          {activeTab === 'base64' && (
            <Base64Tab onSelect={markSelected} setError={setError} />
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-surface-4 px-5 py-4 flex items-center justify-end gap-2">
          <button onClick={onClose}
            className="h-8 px-4 text-sm rounded-btn text-text-secondary hover:text-text-primary hover:bg-surface-3 transition-base duration-base">
            Cancel
          </button>
          <button onClick={handleConfirm} disabled={busy || !hasSelection}
            className="h-8 px-4 text-sm rounded-btn font-medium text-text-inverse bg-accent hover:bg-accent-hover transition-base duration-base disabled:opacity-40">
            {busy ? 'Applying…' : 'Use Icon'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Tab: Auto ────────────────────────────────────────────────────────────────

interface AutoTabProps {
  itemType: ItemType
  itemUrl?: string
  onSelect: (path: string, source: IconSource) => void
  setError: (e: string) => void
  setBusy:  (b: boolean) => void
}

function AutoTab({ itemType, itemUrl, onSelect, setError, setBusy }: AutoTabProps) {
  async function handleReset() {
    if (!itemUrl) { onSelect('', 'auto'); return }
    setBusy(true)
    try {
      const result = await ipc.icons.fetchFavicon(itemUrl)
      onSelect(result.localPath, result.localPath ? 'favicon' : 'auto')
    } catch {
      setError('Could not fetch favicon — using type icon')
      onSelect('', 'auto')
    } finally { setBusy(false) }
  }

  // Auto-fetch on mount so the preview populates immediately when the tab opens
  useEffect(() => {
    if (itemType === 'url' && itemUrl) handleReset()
  }, [])  // mount-only — itemUrl is stable for the lifetime of this modal instance

  return (
    <div className="flex flex-col gap-3 text-center">
      <p className="text-xs text-text-secondary leading-relaxed">
        {itemType === 'url' && itemUrl
          ? 'Command-Center will automatically fetch the favicon for this URL.'
          : 'No auto-icon available for this item type. Choose another tab.'}
      </p>
      {itemType === 'url' && itemUrl && (
        <button onClick={handleReset}
          className="self-center flex items-center gap-2 px-3 h-8 rounded-btn text-xs border border-surface-4 text-text-secondary hover:text-text-primary hover:bg-surface-3 transition-base duration-base">
          <RefreshCw size={12} /> Re-fetch Favicon
        </button>
      )}
      <p className="text-[12px] text-text-muted">
        Or use another tab to set a custom icon.
      </p>
    </div>
  )
}

// ─── Tab: Emoji ───────────────────────────────────────────────────────────────

function EmojiTab({ onSelect }: { onSelect: (emoji: string) => void }) {
  const [search, setSearch] = useState('')
  const filtered = search.trim()
    ? EMOJI_GROUPS.map(g => ({ ...g, emojis: g.emojis.filter(() => true) })) // no text search on emoji
    : EMOJI_GROUPS

  return (
    <div className="flex flex-col gap-3">
      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Type any emoji directly…"
        className="h-8 px-3 text-sm bg-surface-3 rounded-input border border-surface-4 text-text-primary placeholder:text-text-muted outline-none focus:border-accent transition-base duration-base" />
      {search.trim() && (
        // Direct emoji input — let user paste/type any emoji
        <button onClick={() => onSelect(search.trim())}
          className="self-start flex items-center gap-2 px-3 h-8 rounded-btn text-xs border border-accent bg-accent-soft text-text-primary transition-base duration-base">
          Use "{search.trim()}" as icon
        </button>
      )}
      {filtered.map(group => (
        <div key={group.label}>
          <p className="text-[12px] text-text-muted mb-1.5 uppercase tracking-wide">{group.label}</p>
          <div className="flex flex-wrap gap-1">
            {group.emojis.map(emoji => (
              <button key={emoji} onClick={() => onSelect(emoji)} title={emoji}
                className="w-8 h-8 flex items-center justify-center rounded-btn text-base hover:bg-surface-3 transition-base duration-base">
                {emoji}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Tab: Library ─────────────────────────────────────────────────────────────

// Colour presets — same palette as ColorPicker.tsx
const ICON_COLOR_PRESETS = [
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7',
  '#ec4899', '#ef4444', '#f97316', '#f59e0b',
  '#22c55e', '#10b981', '#14b8a6', '#06b6d4',
]

function LibraryTab({
  onSelect, selected, color, onColorChange,
}: {
  onSelect: (name: string) => void
  selected: string
  color: string
  onColorChange: (c: string) => void
}) {
  const [search, setSearch] = useState('')
  const lower = search.trim().toLowerCase()

  const toShow = lower
    ? ALL_ICON_NAMES.filter(n => n.toLowerCase().includes(lower)).slice(0, SEARCH_LIMIT)
    : DEFAULT_ICONS

  // ── Virtual scroll state ────────────────────────────────────────────────
  const scrollRef    = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewHeight, setViewHeight] = useState(400)

  // Observe container height on mount and whenever it changes
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setViewHeight(el.clientHeight))
    ro.observe(el)
    setViewHeight(el.clientHeight)
    return () => ro.disconnect()
  }, [])

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop((e.currentTarget as HTMLDivElement).scrollTop)
  }, [])

  // Derived virtual window
  const totalRows  = Math.ceil(toShow.length / COLS)
  const firstRow   = Math.max(0, Math.floor(scrollTop / CELL_SIZE) - BUFFER_ROWS)
  const visibleRows= Math.ceil(viewHeight / CELL_SIZE) + BUFFER_ROWS * 2
  const lastRow    = Math.min(totalRows - 1, firstRow + visibleRows)
  const firstIdx   = firstRow * COLS
  const lastIdx    = Math.min(toShow.length - 1, (lastRow + 1) * COLS - 1)
  const paddingTop = firstRow * CELL_SIZE
  const paddingBot = Math.max(0, (totalRows - lastRow - 1)) * CELL_SIZE
  const visible    = toShow.slice(firstIdx, lastIdx + 1)

  return (
    <div className="flex flex-col gap-3 min-h-0">
      <div className="flex items-center gap-2">
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setScrollTop(0) }}
          placeholder={`Search ${ALL_ICON_NAMES.length} icons…`}
          autoFocus
          className="flex-1 h-8 px-3 text-sm bg-surface-3 rounded-input border border-surface-4 text-text-primary placeholder:text-text-muted outline-none focus:border-accent transition-base duration-base"
        />
        {lower && (
          <span className="text-[12px] text-text-muted shrink-0">
            {toShow.length}{toShow.length === SEARCH_LIMIT ? '+' : ''} result{toShow.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Scrollable virtual viewport — fixed height so parent modal controls overall height */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="overflow-y-auto"
        style={{ height: 360 }}
      >
        {/* Spacer above rendered rows */}
        {paddingTop > 0 && <div style={{ height: paddingTop }} />}

        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}
        >
          {visible.map(name => (
            <LibraryGridItem key={name} name={name} active={selected === name} onSelect={onSelect} />
          ))}
        </div>

        {/* Spacer below rendered rows */}
        {paddingBot > 0 && <div style={{ height: paddingBot }} />}
      </div>

      {lower && toShow.length === 0 && (
        <p className="text-xs text-text-muted text-center py-4">No icons match "{search}"</p>
      )}

      {/* ── Icon Colour ───────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 pt-1 border-t border-surface-4">
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-text-muted uppercase tracking-wide">Icon Colour</span>
          {color && (
            <button
              onClick={() => onColorChange('')}
              className="text-[12px] text-text-muted hover:text-text-secondary transition-base duration-base"
            >
              Reset
            </button>
          )}
        </div>

        {/* 12 preset swatches + separator + custom hex — single non-wrapping row */}
        <div className="flex items-center gap-1.5 flex-nowrap">
          {ICON_COLOR_PRESETS.map(preset => (
            <button
              key={preset}
              title={preset}
              onClick={() => onColorChange(color === preset ? '' : preset)}
              className="w-6 h-6 rounded-btn border-2 transition-base duration-base shrink-0"
              style={{
                backgroundColor: preset,
                borderColor:     color === preset ? '#fff'             : 'transparent',
                boxShadow:       color === preset ? `0 0 0 1px ${preset}` : 'none',
              }}
            />
          ))}

          {/* Separator */}
          <div className="w-px h-4 bg-surface-4 mx-0.5 shrink-0" />

          {/* Custom hex swatch preview */}
          <div
            className="w-6 h-6 rounded-btn shrink-0 border border-surface-4"
            style={{ backgroundColor: color && !ICON_COLOR_PRESETS.includes(color) ? color : 'transparent' }}
          />

          {/* Custom hex input — stays on same line, never wraps */}
          <input
            type="text"
            value={ICON_COLOR_PRESETS.includes(color) ? '' : color}
            onChange={e => {
              const v = e.target.value.trim()
              if (!v) { onColorChange(''); return }
              const hex = v.startsWith('#') ? v : `#${v}`
              if (/^#[0-9a-fA-F]{0,6}$/.test(hex)) onColorChange(hex)
            }}
            onBlur={e => {
              const v = e.target.value.trim()
              if (!v) return
              const hex = v.startsWith('#') ? v : `#${v}`
              if (!/^#[0-9a-fA-F]{6}$/.test(hex)) onColorChange('')
            }}
            placeholder="#3b82f6"
            maxLength={7}
            className="w-20 h-6 px-2 text-xs font-mono bg-surface-3 rounded-input border border-surface-4 text-text-primary placeholder:text-text-muted outline-none focus:border-accent transition-base duration-base shrink-0"
          />
        </div>
      </div>
    </div>
  )
}

// Async icon grid button — only renders when scrolled into view (virtual scroll).
// Icon loads once on mount; cache in lucide-registry means instant on revisit.
function LibraryGridItem({ name, active, onSelect }: { name: string; active: boolean; onSelect: (n: string) => void }) {
  const [icon, setIcon] = useState<LucideIcon | null>(null)
  useEffect(() => { loadLucideIcon(name).then(setIcon) }, [name])
  const Icon = icon
  return (
    <button
      onClick={() => onSelect(name)}
      className={[
        'group relative flex items-center justify-center rounded-btn transition-base duration-base',
        'focus:outline-none',
        active
          ? 'bg-accent-soft text-text-primary'
          : 'text-text-secondary hover:bg-surface-3 hover:text-text-primary',
      ].join(' ')}
      style={{ width: CELL_SIZE - 4, height: CELL_SIZE - 4 }}
    >
      {/* Icon or loading skeleton */}
      {Icon
        ? <Icon size={16} strokeWidth={1.75} />
        : <span className="w-4 h-4 rounded-sm bg-surface-4 animate-pulse" />
      }
      {/* Hover label — tooltip chip, floats above sibling rows via z-10 */}
      <span className={[
        'absolute top-full left-1/2 -translate-x-1/2 mt-1 px-1.5 py-0.5',
        'text-[11px] leading-tight text-text-primary bg-surface-1 border border-surface-4',
        'rounded shadow-md whitespace-nowrap pointer-events-none z-20',
        'transition-opacity duration-fast',
        active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
      ].join(' ')}>
        {name}
      </span>
    </button>
  )
}

// ─── Tab: Upload ──────────────────────────────────────────────────────────────

interface TabSelectProps {
  onSelect: (path: string, source: IconSource, previewUri?: string) => void
  setError: (e: string) => void
}

function UploadTab({ onSelect, setError }: TabSelectProps) {
  const [busy, setBusy] = useState(false)

  async function handleBrowse() {
    const result = await ipc.system.showOpenDialog({
      type: 'file',
      title: 'Select Icon',
      filters: [{ name: 'Images', extensions: ['png', 'svg', 'jpg', 'jpeg', 'ico'] }],
    })
    if (!result) return
    setBusy(true)
    try {
      const { dataUri } = await ipc.icons.previewLocal(result)
      // Preview loaded — mark selected with the source path
      // The actual save to assets/ happens on "Use Icon" → caller calls icons:saveUpload
      onSelect(result, 'custom', dataUri)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read file')
    } finally { setBusy(false) }
  }

  return (
    <div className="flex flex-col gap-3 items-center">
      <div className="w-full border-2 border-dashed border-surface-4 rounded-lg p-6 flex flex-col items-center gap-3 text-center">
        <Upload size={24} className="text-text-muted" />
        <p className="text-xs text-text-secondary">
          Drag & drop an image here, or click Browse.<br />
          <span className="text-text-muted">Supported: PNG, SVG, JPG, ICO</span>
        </p>
        <button onClick={handleBrowse} disabled={busy}
          className="h-8 px-4 text-xs rounded-btn border border-surface-4 text-text-secondary hover:text-text-primary hover:bg-surface-3 transition-base duration-base disabled:opacity-50">
          {busy ? 'Loading…' : 'Browse…'}
        </button>
      </div>
    </div>
  )
}

// ─── Tab: URL ─────────────────────────────────────────────────────────────────

function UrlTab({ onSelect, setError }: TabSelectProps) {
  const [url,  setUrl]  = useState('')
  const [busy, setBusy] = useState(false)
  const lastFetched = useRef('')

  async function handleFetch() {
    const trimmed = url.trim()
    if (!trimmed || trimmed === lastFetched.current) return
    setBusy(true)
    setError('')
    try {
      const { dataUri } = await ipc.icons.previewUrl(trimmed)
      lastFetched.current = trimmed
      // Pass the URL as path (will be saved to disk on confirm)
      onSelect(trimmed, 'custom', dataUri)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load image from URL')
    } finally { setBusy(false) }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-text-muted">
        Paste a direct link to any image. It will be downloaded once and stored locally.
      </p>
      <div className="flex gap-1.5">
        <input value={url} onChange={e => setUrl(e.target.value)}
          onBlur={handleFetch}
          onKeyDown={e => { if (e.key === 'Enter') handleFetch() }}
          placeholder="https://example.com/icon.png"
          className="flex-1 h-8 px-3 text-sm bg-surface-3 rounded-input border border-surface-4 text-text-primary placeholder:text-text-muted outline-none focus:border-accent transition-base duration-base" />
        <button onClick={handleFetch} disabled={busy || !url.trim()}
          className="h-8 px-3 text-xs rounded-btn border border-surface-4 text-text-secondary hover:text-text-primary hover:bg-surface-3 transition-base duration-base disabled:opacity-50">
          {busy ? '…' : 'Load'}
        </button>
      </div>
    </div>
  )
}

// ─── Tab: Base64 ──────────────────────────────────────────────────────────────

function Base64Tab({ onSelect, setError }: TabSelectProps) {
  const [b64, setB64] = useState('')

  function handleInput(value: string) {
    setB64(value)
    setError('')
    if (!value.trim()) return
    try {
      // Decode to validate — if it starts with data: URI, use directly as preview
      const isDataUri = value.trim().startsWith('data:image/')
      const previewUri = isDataUri ? value.trim() : `data:image/png;base64,${value.trim()}`
      onSelect(value.trim(), 'custom', previewUri)
    } catch {
      setError('Invalid base64 data')
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-text-muted">
        Paste a base64-encoded image string (with or without the data:image/… prefix).
      </p>
      <textarea value={b64}
        onChange={e => handleInput(e.target.value)}
        rows={5} placeholder="data:image/png;base64,iVBORw0KGgo…"
        className="px-3 py-2 text-xs font-mono bg-surface-3 rounded-input border border-surface-4 text-text-primary placeholder:text-text-muted outline-none focus:border-accent transition-base duration-base resize-none" />
    </div>
  )
}
