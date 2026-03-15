import { useState, useEffect, useRef } from 'react'
import { X, FolderOpen } from 'lucide-react'
import { loadLucideIcon } from '../../utils/lucide-registry'
import type { LucideIcon } from 'lucide-react'
import type { Item, ItemType, IconSource, CreateItemInput, UpdateItemInput } from '../../types'
import { WORD_LIMIT } from './ItemNoteDropdown'
import { ipc } from '../../utils/ipc'
import { ITEM_TYPE_DEFS } from './ItemIcons'
import { ACTION_DEFS } from './ActionDefs'
import IconPicker, { type IconSelection } from './IconPicker'

// Convert a relative DB icon path to a commanddeck-asset:// URL
const assetUrl = (rel: string) => `command-center-asset://${rel}`

interface ItemFormPanelProps {
  cardId: string
  editing?: Item
  onClose: () => void
  onCreate: (input: CreateItemInput) => Promise<void>
  onUpdate: (input: UpdateItemInput) => Promise<void>
  onDelete?: (id: string) => Promise<void>
}

export default function ItemFormPanel({
  cardId, editing, onClose, onCreate, onUpdate, onDelete,
}: ItemFormPanelProps) {
  const [label, setLabel] = useState(editing?.label ?? '')
  const [path, setPath] = useState(editing?.path ?? '')
  const [type, setType] = useState<ItemType>(editing?.type ?? 'url')
  const [iconPath, setIconPath] = useState(editing?.iconPath ?? '')
  const [iconSource, setIconSource] = useState<IconSource>(editing?.iconSource ?? 'auto')
  const [iconColor, setIconColor] = useState(editing?.iconColor ?? '')  // library only — hex or ''
  // previewUri holds a base64 data URI for upload/url/base64 icons before they are
  // saved to disk. Used in the icon button preview so the raw Windows path never
  // reaches assetUrl() and causes command-center-asset://C:\... invalid URL errors.
  // Cleared on save (after that point iconPath is a valid assets/ relative path).
  const [iconPreviewUri, setIconPreviewUri] = useState<string | undefined>(undefined)
  const [showPicker, setShowPicker] = useState(false)
  const [commandArgs, setCommandArgs] = useState(editing?.commandArgs ?? '')
  const [workingDir, setWorkingDir] = useState(editing?.workingDir ?? '')
  const [actionId, setActionId] = useState(editing?.actionId ?? '')
  const [customCmd, setCustomCmd] = useState(
    // For custom action: path stores the shell command
    editing?.type === 'action' && editing.actionId === 'custom' ? editing.path : ''
  )
  // In edit mode, track the original label so auto-fill doesn't stomp user-renamed items
  const originalLabelRef = useRef<string | null>(editing ? editing.label : null)
  const [note, setNote] = useState(editing?.note ?? '')
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>(editing?.tags ?? [])
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const labelRef = useRef<HTMLInputElement>(null)

  useEffect(() => { labelRef.current?.focus() }, [])
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Auto-fetch favicon for URL items:
  //  - on mount if editing and URL already present
  //  - on URL field change (debounced 700ms) when user types a new URL
  // Skipped if user has set a custom/emoji/library icon — don't stomp deliberate choices.
  const faviconDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (type !== 'url') return
    if (iconSource === 'custom' || iconSource === 'emoji' || iconSource === 'library') return
    const url = path.trim()
    if (!url) return

    const doFetch = async () => {
      try {
        const { localPath } = await ipc.icons.fetchFavicon(url)
        if (localPath) {
          setIconPath(localPath)
          setIconSource('favicon')
        }
      } catch { /* non-blocking — icon stays as-is on failure */ }
    }

    if (faviconDebounce.current) clearTimeout(faviconDebounce.current)
    // Immediate on mount (editing with existing URL), debounced while typing
    faviconDebounce.current = setTimeout(doFetch, 700)

    return () => {
      if (faviconDebounce.current) clearTimeout(faviconDebounce.current)
    }
  }, [path, type])  // re-runs whenever URL field changes

  // Auto-fill label when an action is selected — only if:
  // • Add mode: label is empty or still matches the previous action's label
  // • Edit mode: label still matches the ORIGINAL saved label (user hasn't customized it)
  function selectAction(id: string) {
    setActionId(id)
    setErrors(p => ({ ...p, actionId: '' }))
    const newDef = ACTION_DEFS.find(a => a.id === id)
    const prevDef = ACTION_DEFS.find(a => a.id === actionId)
    const isEditMode = !!editing
    if (newDef) {
      const labelMatchesPrev = label === (prevDef?.label ?? '')
      const labelMatchesOriginal = label === (originalLabelRef.current ?? '')
      const shouldAutoFill = isEditMode
        ? labelMatchesOriginal   // edit mode: only overwrite if label was never changed from original
        : !label || labelMatchesPrev  // add mode: overwrite if empty or still tracking prev action label
      if (shouldAutoFill) setLabel(newDef.label)
    }
  }

  function addTag(raw: string) {
    const t = raw.trim().toLowerCase().replace(/^#/, '')
    if (!t || tags.includes(t)) { setTagInput(''); return }
    setTags(prev => [...prev, t])
    setTagInput('')
  }
  function removeTag(t: string) { setTags(prev => prev.filter(x => x !== t)) }

  function validate() {
    const e: Record<string, string> = {}
    if (!label.trim()) e.label = 'Label is required'

    if (type === 'action') {
      if (!actionId) e.actionId = 'Select an action'                                  // catches blank migration rows
      else if (actionId === 'custom' && !customCmd.trim()) e.customCmd = 'Shell command is required'
    } else {
      if (!path.trim()) e.path = type === 'url' ? 'URL is required' : 'Path is required'
    }

    const wc = note.trim().split(/\s+/).filter(Boolean).length
    if (wc > WORD_LIMIT) e.note = `Note exceeds ${WORD_LIMIT} words (${wc})`
    return e
  }

  async function handleSave() {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    setBusy(true)

    // Resolve path: for custom action it's the shell command; for action it's empty
    const resolvedPath =
      type === 'action'
        ? (actionId === 'custom' ? customCmd.trim() : actionId)
        : path.trim()

    // Save pending icon to disk based on what the IconPicker returned.
    // URL and base64 checks MUST come before the upload fallback since
    // those values also fail the 'assets/' prefix check.
    let finalIconPath = iconPath
    let finalIconSource = iconSource
    if (iconSource === 'custom' && iconPath && iconPath.startsWith('http')) {
      // URL tab: download remote image and save locally
      try {
        const { localPath } = await ipc.icons.saveUrl(iconPath)
        finalIconPath = localPath
      } catch { finalIconPath = ''; finalIconSource = 'auto' }
    } else if (iconSource === 'custom' && iconPath && iconPath.startsWith('data:')) {
      // Base64 tab: decode and save locally
      try {
        const { localPath } = await ipc.icons.saveBase64(iconPath)
        finalIconPath = localPath
      } catch { finalIconPath = ''; finalIconSource = 'auto' }
    } else if (iconSource === 'custom' && iconPath && !iconPath.startsWith('assets/')) {
      // Upload tab: copy local file into assets/icons/
      try {
        const { localPath } = await ipc.icons.saveUpload(iconPath)
        finalIconPath = localPath
      } catch { finalIconPath = ''; finalIconSource = 'auto' }
    }

    // Auto-fetch favicon for URL items before saving — bakes correct iconPath into DB on first save
    if (type === 'url' && finalIconSource === 'auto' && resolvedPath) {
      try {
        const { localPath } = await ipc.icons.fetchFavicon(resolvedPath)
        if (localPath) {
          finalIconPath   = localPath
          finalIconSource = 'favicon'
        }
      } catch { /* non-blocking — fall through, item saves with 'auto' if fetch fails */ }
    }

    try {
      const payload = {
        label: label.trim(),
        path: resolvedPath,
        type,
        iconPath: finalIconPath,
        iconSource: finalIconSource,
        iconColor: finalIconSource === 'library' ? iconColor : '',  // only stored for library icons
        note,
        tags,
        commandArgs: type === 'command' ? commandArgs.trim() : '',
        workingDir: type === 'command' ? workingDir.trim() : '',
        actionId: type === 'action' ? actionId : '',
      }
      if (editing) {
        await onUpdate({ id: editing.id, ...payload })
      } else {
        await onCreate({ cardId, ...payload })
      }
      setIconPreviewUri(undefined)  // safe to clear — iconPath is now a valid assets/ path in DB
      onClose()
    } catch (err: unknown) {
      setErrors({ form: err instanceof Error ? err.message : 'Save failed' })
    } finally { setBusy(false) }
  }

  async function handleDelete() {
    if (!editing || !onDelete) return
    if (!window.confirm(`Delete "${editing.label}"?`)) return
    await onDelete(editing.id).catch(console.error)
    onClose()
  }

  const noteWords = note.trim().split(/\s+/).filter(Boolean).length

  async function browseFile(t: ItemType) {
    const filters =
      t === 'software' ? [{ name: 'Executables', extensions: ['exe', 'bat', 'cmd'] }] : []
    const result = await ipc.system.showOpenDialog({
      type: t === 'folder' ? 'folder' : 'file',
      title: t === 'folder' ? 'Select Folder' : 'Select File',
      filters,
    })
    if (result) { setPath(result); setErrors(p => ({ ...p, path: '' })) }
  }

  async function browseWorkDir() {
    const result = await ipc.system.showOpenDialog({ type: 'folder', title: 'Select Working Directory', filters: [] })
    if (result) setWorkingDir(result)
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end"
      style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-surface-2 h-full flex flex-col shadow-panel border-l border-surface-4"
        style={{ width: '360px' }} onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0 border-b border-surface-4">
          <h2 className="text-text-primary font-semibold text-sm">
            {editing ? 'Edit Item' : 'Add Item'}
          </h2>
          <button onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-btn text-text-muted hover:text-text-primary hover:bg-surface-3 transition-base duration-base">
            <X size={14} />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          {errors.form && (
            <div className="px-3 py-2 rounded-input bg-danger/10 text-danger text-xs">{errors.form}</div>
          )}

          {/* Icon field */}
          <Field label="Icon">
            <button type="button" onClick={() => setShowPicker(true)}
              className="flex items-center gap-3 h-10 px-3 rounded-input border border-surface-4 hover:border-accent bg-surface-3 transition-base duration-base w-full text-left">
              <div className="w-6 h-6 flex items-center justify-center shrink-0">
                {iconSource === 'emoji' && <span className="text-base leading-none">{iconPath}</span>}
                {iconSource === 'library' && (
                  <LibraryIconPreview name={iconPath} color={iconColor || undefined} />
                )}
                {(iconSource === 'custom' || iconSource === 'favicon') && (iconPreviewUri || iconPath) && (
                  // Use previewUri (base64) when available — covers upload/url/base64 before save
                  // where iconPath is still a raw Windows path, not a valid assets/ relative path.
                  // After save, iconPreviewUri is cleared and iconPath is a safe assets/icons/... path.
                  <img
                    src={iconPreviewUri ?? assetUrl(iconPath)}
                    className="w-6 h-6 object-contain rounded-sm"
                    alt=""
                  />
                )}
                {(iconSource === 'auto' || !iconPath) && (
                  <span className="text-[12px] text-text-muted italic">auto</span>
                )}
              </div>
              <span className="text-xs text-text-secondary flex-1 truncate">
                {iconSource === 'auto' ? 'Auto (favicon for URLs)' : `${iconSource}: ${iconPath.slice(-30)}`}
              </span>
              <span className="text-[12px] text-text-muted shrink-0">Change…</span>
            </button>
          </Field>

          {/* Label — always visible */}
          <Field label="Label" error={errors.label}>
            <input ref={labelRef} value={label}
              onChange={e => { setLabel(e.target.value); setErrors(p => ({ ...p, label: '' })) }}
              placeholder="e.g. GitHub, VSCode…" maxLength={200}
              className={inputCls(!!errors.label)} />
          </Field>

          {/* Type tabs */}
          <Field label="Type">
            <div className="flex gap-1.5 flex-wrap">
              {ITEM_TYPE_DEFS.map(def => {
                const active = type === def.value
                return (
                  <button key={def.value} onClick={() => setType(def.value)}
                    className={['flex items-center gap-1.5 px-2.5 h-7 rounded-btn text-xs transition-base duration-base border',
                      active
                        ? 'bg-accent-soft text-text-primary border-accent'
                        : 'text-text-secondary hover:text-text-primary hover:bg-surface-3 border-surface-4',
                    ].join(' ')}>
                    <def.Icon size={13} strokeWidth={1.75}
                      className={active ? 'text-text-primary' : def.color} />
                    <span>{def.label}</span>
                  </button>
                )
              })}
            </div>
          </Field>

          {/* ── URL fields ── */}
          {type === 'url' && (
            <Field label="URL" error={errors.path}>
              <input value={path}
                onChange={e => { setPath(e.target.value); setErrors(p => ({ ...p, path: '' })) }}
                placeholder="https://…" className={`${inputCls(!!errors.path)} flex-1`} />
            </Field>
          )}

          {/* ── Software fields ── */}
          {type === 'software' && (
            <Field label="Path" error={errors.path}>
              <div className="flex gap-1.5">
                <input value={path}
                  onChange={e => { setPath(e.target.value); setErrors(p => ({ ...p, path: '' })) }}
                  placeholder="C:\…\app.exe" className={`${inputCls(!!errors.path)} flex-1`} />
                <BrowseBtn onClick={() => browseFile('software')} />
              </div>
            </Field>
          )}

          {/* ── Folder fields ── */}
          {type === 'folder' && (
            <Field label="Folder Path" error={errors.path}>
              <div className="flex gap-1.5">
                <input value={path}
                  onChange={e => { setPath(e.target.value); setErrors(p => ({ ...p, path: '' })) }}
                  placeholder="C:\…\MyFolder" className={`${inputCls(!!errors.path)} flex-1`} />
                <BrowseBtn onClick={() => browseFile('folder')} />
              </div>
            </Field>
          )}

          {/* ── Command fields ── */}
          {type === 'command' && (<>
            <CommandTemplates onApply={(t) => {
              setLabel(t.label)
              setPath(t.command)
              setCommandArgs(t.args)
              setWorkingDir(t.workingDir)
              setErrors({})
            }} />

            <Field label="Command" error={errors.path}>
              <input value={path}
                onChange={e => { setPath(e.target.value); setErrors(p => ({ ...p, path: '' })) }}
                placeholder="e.g. powershell, cmd, wt, node"
                className={inputCls(!!errors.path)} />
              <span className="text-[12px] text-text-muted leading-snug">
                Executable name (if it's in system PATH) or full path like <span className="font-mono">C:\tools\app.exe</span>
              </span>
            </Field>

            <Field label="Arguments (optional)">
              <input value={commandArgs} onChange={e => setCommandArgs(e.target.value)}
                placeholder="e.g. -NoExit -Command &quot;Get-Process&quot;"
                className={inputCls(false)} />
              <span className="text-[12px] text-text-muted leading-snug">
                Flags passed to the command, space-separated. Wrap args with spaces in "quotes".
              </span>
            </Field>

            <Field label="Working Directory (optional)">
              <div className="flex gap-1.5">
                <input value={workingDir} onChange={e => setWorkingDir(e.target.value)}
                  placeholder="Leave empty → uses Documents folder"
                  className={`${inputCls(false)} flex-1`} />
                <BrowseBtn onClick={browseWorkDir} />
              </div>
              <span className="text-[12px] text-text-muted leading-snug">
                Folder where the command starts. Set this to your project root for git / npm commands.
              </span>
            </Field>
          </>)}

          {/* ── Action fields ── */}
          {type === 'action' && (
            <Field label="Choose Action" error={errors.actionId}>
              {/* 4-column action grid */}
              <div className="grid grid-cols-4 gap-1">
                {ACTION_DEFS.map(def => {
                  const active = actionId === def.id
                  return (
                    <button key={def.id} title={def.label}
                      onClick={() => selectAction(def.id)}
                      className={[
                        'flex flex-col items-center gap-1 py-2 px-1 rounded-btn text-center',
                        'transition-base duration-base border text-xs',
                        active
                          ? 'bg-accent-soft border-accent text-text-primary'
                          : 'border-surface-4 text-text-secondary hover:text-text-primary hover:bg-surface-3',
                      ].join(' ')}>
                      <def.Icon size={16} strokeWidth={1.75}
                        className={active ? 'text-text-primary' : 'text-text-secondary'} />
                      <span className="leading-tight line-clamp-1 text-[11px]">{def.label}</span>
                    </button>
                  )
                })}
              </div>
              {/* No selection yet — shown in edit mode if action_id was blank in DB */}
              {!actionId && (
                <span className="text-[12px] text-text-muted leading-snug">
                  Select an action above.
                  {editing && ' Previously-saved action data was missing — please re-select.'}
                </span>
              )}
              {/* Custom action shell command input */}
              {actionId === 'custom' && (
                <div className="mt-2">
                  <Field label="Shell Command" error={errors.customCmd}>
                    <input value={customCmd}
                      onChange={e => { setCustomCmd(e.target.value); setErrors(p => ({ ...p, customCmd: '' })) }}
                      placeholder="e.g. explorer.exe shell:RecycleBinFolder"
                      className={inputCls(!!errors.customCmd)} />
                    <span className="text-[12px] text-text-muted leading-snug">
                      PowerShell expression, Windows URI (<span className="font-mono">shell:startup</span>, <span className="font-mono">ms-settings:display</span>), or path to an .exe / .msc file.
                    </span>
                  </Field>
                </div>
              )}
            </Field>
          )}

          {/* Tags */}
          <Field label="Tags">
            <div className="flex flex-wrap gap-1 mb-1.5">
              {tags.map(t => (
                <span key={t} className="flex items-center gap-1 px-2 py-0.5 rounded-pill bg-accent-soft text-accent text-xs">
                  #{t}
                  <button onClick={() => removeTag(t)}
                    className="hover:opacity-70 transition-base duration-base leading-none">×</button>
                </span>
              ))}
            </div>
            <input value={tagInput} onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagInput) } }}
              placeholder="Type tag + Enter" maxLength={50} className={inputCls(false)} />
          </Field>

          {/* Note */}
          <Field label={`Note (${noteWords}/${WORD_LIMIT} words)`} error={errors.note}>
            <textarea value={note}
              onChange={e => { setNote(e.target.value); setErrors(p => ({ ...p, note: '' })) }}
              placeholder="Optional notes…" rows={4}
              className={`${inputCls(!!errors.note)} resize-none`} />
          </Field>
        </div>

        {/* ── Footer ── */}
        <div className="shrink-0 border-t border-surface-4 px-5 py-4 flex items-center gap-2">
          {editing && onDelete && (
            <button onClick={handleDelete}
              className="text-xs text-danger hover:opacity-80 transition-base duration-base mr-auto">
              Delete
            </button>
          )}
          <button onClick={onClose}
            className="h-8 px-4 text-sm rounded-btn text-text-secondary hover:text-text-primary hover:bg-surface-3 transition-base duration-base ml-auto">
            Cancel
          </button>
          <button onClick={handleSave} disabled={busy}
            className="h-8 px-4 text-sm rounded-btn font-medium text-text-inverse bg-accent hover:bg-accent-hover transition-base duration-base disabled:opacity-50">
            {busy ? 'Saving…' : editing ? 'Save' : 'Add Item'}
          </button>
        </div>
      </div>

      {/* IconPicker modal — floats above form panel */}
      <IconPickerPortal
        open={showPicker}
        currentIconPath={iconPath}
        currentIconSource={iconSource}
        currentIconColor={iconColor || undefined}
        itemType={type}
        itemUrl={type === 'url' ? path : undefined}
        onSelect={(sel: IconSelection) => {
          setIconPath(sel.iconPath)
          setIconSource(sel.iconSource)
          setIconPreviewUri(sel.previewUri)  // carry base64 preview so the form button doesn't
          setIconColor(sel.iconColor ?? '')  // persist chosen library colour
          setShowPicker(false)               // try to load a raw Windows path via assetUrl()
        }}
        onClose={() => setShowPicker(false)}
      />
    </div>
  )
}

// IconPicker is rendered via portal so it floats above the form panel
function IconPickerPortal({ open, ...props }: { open: boolean } & React.ComponentProps<typeof IconPicker>) {
  if (!open) return null
  return <IconPicker {...props} />
}

// ── Command templates ────────────────────────────────────────────────────────

interface CommandTemplate {
  label: string   // auto-fills the Label field
  command: string   // auto-fills the Command field
  args: string   // auto-fills the Arguments field
  workingDir: string   // auto-fills the Working Dir field ('' = leave empty)
  hint: string   // shown on hover / below chip
}

const COMMAND_TEMPLATES: CommandTemplate[] = [
  {
    label: 'PowerShell',
    command: 'powershell',
    args: '-NoExit',
    workingDir: '',
    hint: 'Opens a persistent PowerShell window',
  },
  {
    label: 'Command Prompt',
    command: 'cmd',
    args: '/K echo Ready',
    workingDir: '',
    hint: 'Opens cmd.exe and keeps it open',
  },
  {
    label: 'Windows Terminal',
    command: 'wt',
    args: '',
    workingDir: '',
    hint: 'Opens Windows Terminal (requires WT installed)',
  },
  {
    label: 'Node REPL',
    command: 'node',
    args: '',
    workingDir: '',
    hint: 'Opens the interactive Node.js REPL',
  },
  {
    label: 'Python Shell',
    command: 'python',
    args: '',
    workingDir: '',
    hint: 'Opens the interactive Python interpreter',
  },
  {
    label: 'Git Log',
    command: 'cmd',
    args: '/K git log --oneline -20',
    workingDir: '',
    hint: 'Shows last 20 commits — set Working Dir to your repo root',
  },
  {
    label: 'NPM Start',
    command: 'cmd',
    args: '/K npm start',
    workingDir: '',
    hint: 'Runs npm start — set Working Dir to your project root',
  },
]

interface CommandTemplatesProps {
  onApply: (t: CommandTemplate) => void
}

function CommandTemplates({ onApply }: CommandTemplatesProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-text-secondary font-medium">Quick Templates</span>
      <p className="text-[12px] text-text-muted leading-snug">
        Click any template to fill all fields instantly — then adjust and hit Add Item to test.
      </p>
      <div className="flex flex-wrap gap-1.5 mt-0.5">
        {COMMAND_TEMPLATES.map(t => (
          <button
            key={t.label}
            type="button"
            title={t.hint}
            onClick={() => onApply(t)}
            className={[
              'flex items-center gap-1 px-2 h-6 rounded-btn border text-[12px]',
              'border-surface-4 text-text-secondary bg-surface-3',
              'hover:border-accent hover:text-text-primary hover:bg-accent-soft',
              'transition-base duration-base',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="border-t border-surface-4 mt-1" />
    </div>
  )
}

// ── Shared sub-components ────────────────────────────────────────────────────

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-text-secondary font-medium">{label}</label>
      {children}
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  )
}

function BrowseBtn({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" title="Browse" onClick={onClick}
      className="w-8 h-8 flex items-center justify-center rounded-btn border border-surface-4 text-text-muted hover:text-text-primary hover:bg-surface-3 transition-base duration-base shrink-0">
      <FolderOpen size={13} />
    </button>
  )
}

// Renders a library icon by name in the form panel icon preview button.
// Returns null while loading so the button area stays clean.
function LibraryIconPreview({ name, color }: { name: string; color?: string }) {
  const [icon, setIcon] = useState<LucideIcon | null>(null)
  useEffect(() => {
    if (!name) return
    loadLucideIcon(name).then(setIcon)
  }, [name])
  if (!icon) return null
  const Icon = icon
  const style = color ? { color } : undefined
  const cls   = color ? undefined : 'text-text-secondary'
  return <Icon size={16} className={cls} style={style} strokeWidth={1.75} />
}

function inputCls(hasError: boolean) {
  return [
    'h-8 px-3 text-sm bg-surface-3 rounded-input border text-text-primary w-full',
    'placeholder:text-text-muted outline-none transition-base duration-base',
    hasError ? 'border-danger' : 'border-surface-4 focus:border-accent',
  ].join(' ')
}
