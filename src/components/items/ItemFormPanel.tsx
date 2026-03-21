import { useState, useEffect, useRef } from 'react'
import { X, FolderOpen } from 'lucide-react'
import { loadLucideIcon } from '../../utils/lucide-registry'
import type { LucideIcon } from 'lucide-react'
import type { Item, ItemType, IconSource, CreateItemInput, UpdateItemInput } from '../../types'
import { WORD_LIMIT } from './ItemNoteDropdown'
import { ipc } from '../../utils/ipc'
import { ITEM_TYPE_DEFS } from './ItemIcons'
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
  const [iconPreviewUri, setIconPreviewUri] = useState<string | undefined>(undefined)
  const [showPicker, setShowPicker] = useState(false)
  const [commandArgs, setCommandArgs] = useState(editing?.commandArgs ?? '')
  const [workingDir, setWorkingDir] = useState(editing?.workingDir ?? '')
  const [note, setNote] = useState(editing?.note ?? '')
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>(editing?.tags ?? [])
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const labelRef = useRef<HTMLInputElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])

  useEffect(() => { labelRef.current?.focus() }, [])
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const faviconDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (type !== 'url') return
    if (iconSource === 'custom' || iconSource === 'url-icon' || iconSource === 'b64-icon' || iconSource === 'emoji' || iconSource === 'library') return
    const url = path.trim()
    if (!url) return

    const doFetch = async () => {
      try {
        const { localPath } = await ipc.icons.fetchFavicon(url)
        if (localPath) {
          setIconPath(localPath)
          setIconSource('favicon')
        }
      } catch { /* non-blocking */ }
    }

    if (faviconDebounce.current) clearTimeout(faviconDebounce.current)
    faviconDebounce.current = setTimeout(doFetch, 700)

    return () => {
      if (faviconDebounce.current) clearTimeout(faviconDebounce.current)
    }
  }, [path, type])

  // Auto-extract file icon for software items — mirrors favicon debounce pattern.
  // Fires when path changes unless user explicitly chose a new icon via picker this session.
  // "custom + iconPreviewUri set" = user picked via IconPicker → don't override.
  // "custom + no iconPreviewUri" = previously auto-extracted → allow re-extraction on path change.
  const fileIconDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (type !== 'software') return
    if (iconSource === 'emoji' || iconSource === 'library') return
    if ((iconSource === 'custom' || iconSource === 'url-icon' || iconSource === 'b64-icon') && iconPreviewUri !== undefined) return
    const filePath = path.trim()
    if (!filePath) return

    const doExtract = async () => {
      try {
        const { localPath } = await ipc.icons.extractFileIcon(filePath)
        if (localPath) {
          setIconPath(localPath)
          setIconSource('custom')
        }
      } catch { /* non-blocking */ }
    }

    if (fileIconDebounce.current) clearTimeout(fileIconDebounce.current)
    fileIconDebounce.current = setTimeout(doExtract, 500)

    return () => {
      if (fileIconDebounce.current) clearTimeout(fileIconDebounce.current)
    }
  }, [path, type])

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

    if (!path.trim()) e.path = type === 'url' ? 'URL is required' : 'Path is required'

    const wc = note.trim().split(/\s+/).filter(Boolean).length
    if (wc > WORD_LIMIT) e.note = `Note exceeds ${WORD_LIMIT} words (${wc})`
    return e
  }

  async function handleSave() {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    setBusy(true)

    const resolvedPath = path.trim()

    let finalIconPath = iconPath
    let finalIconSource = iconSource
    if (iconSource === 'url-icon' && iconPath && !iconPath.startsWith('assets/')) {
      try {
        const { localPath } = await ipc.icons.saveUrl(iconPath)
        finalIconPath = localPath
      } catch { finalIconPath = ''; finalIconSource = 'auto' }
    } else if (iconSource === 'b64-icon' && iconPath && !iconPath.startsWith('assets/')) {
      try {
        const { localPath } = await ipc.icons.saveBase64(iconPath)
        finalIconPath = localPath
      } catch { finalIconPath = ''; finalIconSource = 'auto' }
    } else if (iconSource === 'custom' && iconPath && !iconPath.startsWith('assets/')) {
      try {
        const { localPath } = await ipc.icons.saveUpload(iconPath)
        finalIconPath = localPath
      } catch { finalIconPath = ''; finalIconSource = 'auto' }
    }

    if (type === 'url' && finalIconSource === 'auto' && resolvedPath) {
      try {
        const { localPath } = await ipc.icons.fetchFavicon(resolvedPath)
        if (localPath) {
          finalIconPath   = localPath
          finalIconSource = 'favicon'
        }
      } catch { /* non-blocking */ }
    }

    try {
      const payload = {
        label: label.trim(),
        path: resolvedPath,
        type,
        iconPath: finalIconPath,
        iconSource: finalIconSource,
        iconColor: finalIconSource === 'library' ? iconColor : '',
        note,
        tags,
        commandArgs: type === 'command' ? commandArgs.trim() : '',
        workingDir: type === 'command' ? (workingDir.trim() === 'Set working directory…' ? '' : workingDir.trim()) : '',
      }
      if (editing) {
        await onUpdate({ id: editing.id, ...payload })
      } else {
        await onCreate({ cardId, ...payload })
      }
      setIconPreviewUri(undefined)
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
    const filters = t === 'software' ? [] : []
    const result = await ipc.system.showOpenDialog({
      type: t === 'folder' ? 'folder' : 'file',
      title: t === 'folder' ? 'Select Folder' : 'Select File',
      filters,
      ...(t === 'software' ? { defaultPath: 'C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs' } : {}),
    })
    if (result) { setPath(result); setErrors(p => ({ ...p, path: '' })) }
  }

  async function browseWorkDir() {
    const result = await ipc.system.showOpenDialog({ type: 'folder', title: 'Select Working Directory', filters: [] })
    if (result) setWorkingDir(result)
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div
        className="bg-surface-2 flex flex-col rounded-modal shadow-modal border border-surface-4 w-[540px] max-h-[90vh] transition-all duration-150"
        style={{ opacity: visible ? 1 : 0, transform: visible ? 'scale(1)' : 'scale(0.97)' }}
        onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 shrink-0 border-b border-surface-4">
          <h2 className="text-text-primary font-semibold text-sm">
            {editing ? 'Edit Item' : 'Add Item'}
          </h2>
          <button onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-btn text-text-muted hover:text-text-primary hover:bg-surface-3 transition-base duration-base">
            <X size={14} />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
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
                {(iconSource === 'custom' || iconSource === 'url-icon' || iconSource === 'b64-icon' || iconSource === 'favicon') && (iconPreviewUri || iconPath) && (
                  <img
                    src={iconPreviewUri ?? assetUrl(iconPath)}
                    className={[
                      'w-6 h-6 object-contain rounded-sm',
                      iconSource === 'favicon' ? 'bg-white' : '',
                    ].join(' ')}
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

          {/* Label */}
          <Field label="Label" error={errors.label}>
            <input ref={labelRef} value={label}
              onChange={e => { setLabel(e.target.value); setErrors(p => ({ ...p, label: '' })) }}
              placeholder="e.g. GitHub, VSCode…" maxLength={200}
              className={inputCls(!!errors.label)} />
          </Field>

          {/* ── Type selector — horizontal pill-style tab row ── */}
          <Field label="Type">
            <div className="flex items-center gap-1 p-1 rounded-input bg-surface-3 border border-surface-4">
              {ITEM_TYPE_DEFS.map(def => {
                const active = type === def.value
                return (
                  <button
                    key={def.value}
                    onClick={() => setType(def.value)}
                    className={[
                      'flex flex-1 items-center justify-center gap-1.5 h-7 px-2 rounded-[6px]',
                      'text-[12px] font-medium transition-all duration-150 whitespace-nowrap',
                      active
                        ? 'bg-accent text-white shadow-sm'
                        : 'text-text-muted hover:text-text-primary hover:bg-surface-4',
                    ].join(' ')}
                  >
                    <def.Icon
                      size={12}
                      strokeWidth={2}
                      className={active ? 'text-white' : def.color}
                    />
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
                placeholder="https://…"
                className={inputCls(!!errors.path)}
              />
            </Field>
          )}

          {/* ── Software fields ── */}
          {type === 'software' && (
            <Field label="Path" error={errors.path}>
              <div className="flex gap-1.5">
                <input value={path}
                  onChange={e => { setPath(e.target.value); setErrors(p => ({ ...p, path: '' })) }}
                  placeholder="C:\…\app.exe, script.py, document.pdf" className={`${inputCls(!!errors.path)} flex-1`} />
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
              // SET_WORKING_DIRECTORY = placeholder text shown in the field so user knows to set it
              setWorkingDir(t.requiresWorkDir ? 'Set working directory…' : t.workingDir)
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
                Folder where the command starts. Leave empty to open in your user home folder.
              </span>
            </Field>
          </>)}

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
              placeholder="Optional notes…" rows={6}
              spellCheck={true}
              className={`${inputCls(!!errors.note, true)} resize-y min-h-[80px] max-h-[320px]`} />
          </Field>
        </div>

        {/* ── Footer ── */}
        <div className="shrink-0 border-t border-surface-4 px-6 py-4 flex items-center gap-2">
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

      {/* IconPicker modal */}
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
          setIconPreviewUri(sel.previewUri)
          setIconColor(sel.iconColor ?? '')
          setShowPicker(false)
        }}
        onClose={() => setShowPicker(false)}
      />
    </div>
  )
}

function IconPickerPortal({ open, ...props }: { open: boolean } & React.ComponentProps<typeof IconPicker>) {
  if (!open) return null
  return <IconPicker {...props} />
}

// ── Command templates ────────────────────────────────────────────────────────

interface CommandTemplate {
  label:           string
  command:         string
  args:            string
  workingDir:      string      // '' = no dir needed; 'SET_WORKING_DIRECTORY' = user must set
  hint:            string
  requiresWorkDir: boolean     // true = template needs a project root to work
}

interface TemplateGroup {
  label:     string
  templates: CommandTemplate[]
}

const TEMPLATE_GROUPS: TemplateGroup[] = [
  {
    label: 'Shells',
    templates: [
      { label: 'PowerShell',       command: 'powershell', args: '-NoExit',              workingDir: '',                    requiresWorkDir: false, hint: 'Opens a persistent PowerShell window' },
      { label: 'Command Prompt',   command: 'cmd',        args: '/K echo Ready',         workingDir: '',                    requiresWorkDir: false, hint: 'Opens cmd.exe and keeps it open' },
      { label: 'Windows Terminal', command: 'wt',         args: '',                      workingDir: '',                    requiresWorkDir: false, hint: 'Opens Windows Terminal (requires WT installed)' },
      { label: 'Node REPL',        command: 'node',       args: '',                      workingDir: '',                    requiresWorkDir: false, hint: 'Opens the interactive Node.js REPL' },
      { label: 'Python Shell',     command: 'python',     args: '',                      workingDir: '',                    requiresWorkDir: false, hint: 'Opens the interactive Python interpreter' },
    ],
  },
  {
    label: 'Dev Server',
    templates: [
      { label: 'npm run dev',   command: 'cmd', args: '/K npm run dev',                                  workingDir: 'SET_WORKING_DIRECTORY', requiresWorkDir: true, hint: 'Starts the dev server — set Working Dir to your project root' },
      { label: 'npm start',     command: 'cmd', args: '/K npm start',                                    workingDir: 'SET_WORKING_DIRECTORY', requiresWorkDir: true, hint: 'Runs npm start — set Working Dir to your project root' },
      { label: 'npm run build', command: 'cmd', args: '/K npm run build',                                workingDir: 'SET_WORKING_DIRECTORY', requiresWorkDir: true, hint: 'Runs the build step — set Working Dir to your project root' },
      { label: 'npx vite',      command: 'cmd', args: '/K npx vite',                                     workingDir: 'SET_WORKING_DIRECTORY', requiresWorkDir: true, hint: 'Starts Vite dev server — set Working Dir to your project root' },
      { label: 'uvicorn',       command: 'cmd', args: '/K python -m uvicorn main:app --reload',          workingDir: 'SET_WORKING_DIRECTORY', requiresWorkDir: true, hint: 'FastAPI dev server — set Working Dir to your project root' },
      { label: 'Django',        command: 'cmd', args: '/K python manage.py runserver',                   workingDir: 'SET_WORKING_DIRECTORY', requiresWorkDir: true, hint: 'Django dev server — set Working Dir to your project root' },
    ],
  },
  {
    label: 'Git',
    templates: [
      { label: 'git status', command: 'cmd', args: '/K git status',             workingDir: 'SET_WORKING_DIRECTORY', requiresWorkDir: true, hint: 'Shows working tree status — set Working Dir to your repo root' },
      { label: 'git pull',   command: 'cmd', args: '/K git pull',               workingDir: 'SET_WORKING_DIRECTORY', requiresWorkDir: true, hint: 'Pulls latest changes — set Working Dir to your repo root' },
      { label: 'git log',    command: 'cmd', args: '/K git log --oneline -20',  workingDir: 'SET_WORKING_DIRECTORY', requiresWorkDir: true, hint: 'Shows last 20 commits — set Working Dir to your repo root' },
      { label: 'git diff',   command: 'cmd', args: '/K git diff',               workingDir: 'SET_WORKING_DIRECTORY', requiresWorkDir: true, hint: 'Shows unstaged changes — set Working Dir to your repo root' },
    ],
  },
  {
    label: 'Packages',
    templates: [
      { label: 'npm install',   command: 'cmd', args: '/K npm install',                          workingDir: 'SET_WORKING_DIRECTORY', requiresWorkDir: true,  hint: 'Installs npm dependencies — set Working Dir to your project root' },
      { label: 'pip install',   command: 'cmd', args: '/K pip install -r requirements.txt',      workingDir: 'SET_WORKING_DIRECTORY', requiresWorkDir: true,  hint: 'Installs Python dependencies — set Working Dir to your project root' },
      { label: 'pip list',      command: 'cmd', args: '/K pip list',                              workingDir: '',                      requiresWorkDir: false, hint: 'Lists installed Python packages' },
    ],
  },
  {
    label: 'System',
    templates: [
      { label: 'Lock Screen',     command: 'rundll32', args: 'user32.dll,LockWorkStation',                   workingDir: '', requiresWorkDir: false, hint: 'Locks Windows immediately' },
      { label: 'Sleep',           command: 'rundll32', args: 'powrprof.dll,SetSuspendState 0 1 0',           workingDir: '', requiresWorkDir: false, hint: 'Puts the machine to sleep' },
      { label: 'Shut Down',       command: 'shutdown',  args: '/s /t 0',                                     workingDir: '', requiresWorkDir: false, hint: 'Shuts down immediately — no confirmation' },
      { label: 'Restart',         command: 'shutdown',  args: '/r /t 0',                                     workingDir: '', requiresWorkDir: false, hint: 'Restarts immediately — no confirmation' },
      { label: 'Task Manager',    command: 'Taskmgr.exe', args: '',                                          workingDir: '', requiresWorkDir: false, hint: 'Opens Windows Task Manager' },
      { label: 'Calculator',      command: 'calc.exe',  args: '',                                            workingDir: '', requiresWorkDir: false, hint: 'Opens Windows Calculator' },
      { label: 'Empty Recycle Bin', command: 'powershell', args: '-Command "Clear-RecycleBin -Force -ErrorAction SilentlyContinue"', workingDir: '', requiresWorkDir: false, hint: 'Empties Recycle Bin silently via PowerShell' },
      { label: 'Snipping Tool',   command: 'SnippingTool.exe', args: '',                                     workingDir: '', requiresWorkDir: false, hint: 'Opens Snipping Tool for screenshots' },
      { label: 'tasklist',        command: 'cmd', args: '/K tasklist /v',                                    workingDir: '', requiresWorkDir: false, hint: 'Lists all running processes with details' },
      { label: 'disk usage',      command: 'cmd', args: '/K wmic logicaldisk get size,freespace,caption',    workingDir: '', requiresWorkDir: false, hint: 'Shows disk size and free space for all drives' },
      { label: 'flush DNS',       command: 'cmd', args: '/K ipconfig /flushdns',                             workingDir: '', requiresWorkDir: false, hint: 'Flushes the DNS resolver cache' },
      { label: 'ipconfig',        command: 'cmd', args: '/K ipconfig /all',                                  workingDir: '', requiresWorkDir: false, hint: 'Shows full IP configuration for all adapters' },
      { label: 'hosts file',      command: 'cmd', args: '/K notepad C:\\Windows\\System32\\drivers\\etc\\hosts', workingDir: '', requiresWorkDir: false, hint: 'Opens the Windows hosts file in Notepad' },
      { label: 'env vars',        command: 'cmd', args: '/K set',                                            workingDir: '', requiresWorkDir: false, hint: 'Lists all environment variables' },
      { label: 'ping',            command: 'cmd', args: '/K ping google.com -t',                             workingDir: '', requiresWorkDir: false, hint: 'Continuous ping to google.com — Ctrl+C to stop' },
    ],
  },
  {
    label: 'Network',
    templates: [
      { label: 'curl GET',      command: 'cmd', args: '/K curl https://httpbin.org/get',          workingDir: '', requiresWorkDir: false, hint: 'Sends a test GET request and shows the response' },
      { label: 'curl POST',     command: 'cmd', args: '/K curl -X POST https://httpbin.org/post', workingDir: '', requiresWorkDir: false, hint: 'Sends a test POST request' },
      { label: 'ngrok 5173',    command: 'cmd', args: '/K ngrok http 5173',                       workingDir: '', requiresWorkDir: false, hint: 'Exposes localhost:5173 via ngrok tunnel (requires ngrok in PATH)' },
      { label: 'ngrok 3000',    command: 'cmd', args: '/K ngrok http 3000',                       workingDir: '', requiresWorkDir: false, hint: 'Exposes localhost:3000 via ngrok tunnel' },
      { label: 'netstat',       command: 'cmd', args: '/K netstat -ano',                          workingDir: '', requiresWorkDir: false, hint: 'Shows all active connections with process IDs' },
      { label: 'port check',    command: 'cmd', args: '/K netstat -ano | findstr :3000',          workingDir: '', requiresWorkDir: false, hint: 'Checks what is using port 3000 — edit the port number as needed' },
    ],
  },
  {
    label: 'Docker',
    templates: [
      { label: 'ps',            command: 'cmd', args: '/K docker ps',                             workingDir: '',                      requiresWorkDir: false, hint: 'Lists running containers' },
      { label: 'ps all',        command: 'cmd', args: '/K docker ps -a',                          workingDir: '',                      requiresWorkDir: false, hint: 'Lists all containers including stopped ones' },
      { label: 'images',        command: 'cmd', args: '/K docker images',                         workingDir: '',                      requiresWorkDir: false, hint: 'Lists all local Docker images' },
      { label: 'compose up',    command: 'cmd', args: '/K docker compose up -d',                  workingDir: 'SET_WORKING_DIRECTORY', requiresWorkDir: true,  hint: 'Starts containers in detached mode — set Working Dir to your compose project' },
      { label: 'compose down',  command: 'cmd', args: '/K docker compose down',                   workingDir: 'SET_WORKING_DIRECTORY', requiresWorkDir: true,  hint: 'Stops and removes containers — set Working Dir to your compose project' },
      { label: 'compose logs',  command: 'cmd', args: '/K docker compose logs -f',                workingDir: 'SET_WORKING_DIRECTORY', requiresWorkDir: true,  hint: 'Follows live container logs — set Working Dir to your compose project' },
    ],
  },
  {
    label: 'Python',
    templates: [
      { label: 'create venv',   command: 'cmd', args: '/K python -m venv venv',                   workingDir: 'SET_WORKING_DIRECTORY', requiresWorkDir: true,  hint: 'Creates a virtual environment in a venv/ folder' },
      { label: 'activate venv', command: 'cmd', args: '/K venv\\Scripts\\activate',               workingDir: 'SET_WORKING_DIRECTORY', requiresWorkDir: true,  hint: 'Activates the virtual environment — set Working Dir to your project root' },
      { label: 'run script',    command: 'cmd', args: '/K python main.py',                        workingDir: 'SET_WORKING_DIRECTORY', requiresWorkDir: true,  hint: 'Runs main.py — edit the filename as needed' },
      { label: 'freeze deps',   command: 'cmd', args: '/K pip freeze > requirements.txt',         workingDir: 'SET_WORKING_DIRECTORY', requiresWorkDir: true,  hint: 'Exports installed packages to requirements.txt' },
      { label: 'deactivate',    command: 'cmd', args: '/K deactivate',                            workingDir: '',                      requiresWorkDir: false, hint: 'Deactivates the active virtual environment' },
    ],
  },
  {
    label: 'Node',
    templates: [
      { label: 'run index.js',  command: 'cmd', args: '/K node index.js',                         workingDir: 'SET_WORKING_DIRECTORY', requiresWorkDir: true,  hint: 'Runs index.js — edit the filename as needed' },
      { label: 'ts-node',       command: 'cmd', args: '/K npx ts-node src/index.ts',              workingDir: 'SET_WORKING_DIRECTORY', requiresWorkDir: true,  hint: 'Runs a TypeScript file directly via ts-node' },
      { label: 'npm list',      command: 'cmd', args: '/K npm list --depth=0',                    workingDir: 'SET_WORKING_DIRECTORY', requiresWorkDir: true,  hint: 'Lists top-level installed npm packages' },
      { label: 'npm outdated',  command: 'cmd', args: '/K npm outdated',                          workingDir: 'SET_WORKING_DIRECTORY', requiresWorkDir: true,  hint: 'Shows packages with newer versions available' },
      { label: 'node version',  command: 'cmd', args: '/K node --version && npm --version',       workingDir: '',                      requiresWorkDir: false, hint: 'Prints Node.js and npm versions' },
    ],
  },
  {
    label: 'Ports',
    templates: [
      { label: 'who uses :3000', command: 'cmd', args: '/K netstat -ano | findstr :3000',         workingDir: '', requiresWorkDir: false, hint: 'Shows what process is using port 3000' },
      { label: 'who uses :5173', command: 'cmd', args: '/K netstat -ano | findstr :5173',         workingDir: '', requiresWorkDir: false, hint: 'Shows what process is using port 5173 (Vite default)' },
      { label: 'who uses :8080', command: 'cmd', args: '/K netstat -ano | findstr :8080',         workingDir: '', requiresWorkDir: false, hint: 'Shows what process is using port 8080' },
      { label: 'kill :3000',     command: 'powershell', args: '-NoExit -Command "Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force; Write-Host Killed PID $_ }; Write-Host Done"', workingDir: '', requiresWorkDir: false, hint: 'Force-kills whatever process is holding port 3000' },
      { label: 'node procs',     command: 'cmd', args: '/K tasklist | findstr node',              workingDir: '', requiresWorkDir: false, hint: 'Lists all running node processes' },
      { label: 'python procs',   command: 'cmd', args: '/K tasklist | findstr python',            workingDir: '', requiresWorkDir: false, hint: 'Lists all running python processes' },
    ],
  },
  {
    label: 'SSH',
    templates: [
      { label: 'SSH connect',   command: 'cmd', args: '/K ssh user@your-server-ip',              workingDir: '', requiresWorkDir: false, hint: 'SSH into a server — edit user and IP after applying' },
      { label: 'SSH with key',  command: 'cmd', args: '/K ssh -i C:\\path\\to\\key.pem user@host', workingDir: '', requiresWorkDir: false, hint: 'SSH with a PEM key — edit path, user, and host after applying' },
      { label: 'SCP upload',    command: 'cmd', args: '/K scp file.txt user@host:/remote/path',  workingDir: '', requiresWorkDir: false, hint: 'Uploads a file to a remote server — edit all parts after applying' },
      { label: 'SCP download',  command: 'cmd', args: '/K scp user@host:/remote/file.txt .',     workingDir: '', requiresWorkDir: false, hint: 'Downloads a file from a remote server to current directory' },
    ],
  },
]

interface CommandTemplatesProps {
  onApply: (t: CommandTemplate) => void
}

function CommandTemplates({ onApply }: CommandTemplatesProps) {
  const [openGroup, setOpenGroup] = useState<string | null>(null)

  function handleSelect(t: CommandTemplate) {
    onApply(t)
    setOpenGroup(null)   // close dropdown after selection
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-text-secondary font-medium">Quick Templates</span>
      <p className="text-[12px] text-text-muted leading-snug">
        Pick a category, then select a template — all fields fill instantly.
      </p>

      {/* Group buttons row */}
      <div className="relative flex flex-wrap gap-1.5 mt-0.5">
        {TEMPLATE_GROUPS.map(group => {
          const isOpen = openGroup === group.label
          return (
            <div key={group.label} className="relative">
              {/* Category trigger button */}
              <button
                type="button"
                onClick={() => setOpenGroup(isOpen ? null : group.label)}
                className={[
                  'flex items-center gap-1 px-2.5 h-7 rounded-btn border text-[12px] font-medium',
                  'transition-base duration-base',
                  isOpen
                    ? 'border-accent text-text-primary bg-accent-soft'
                    : 'border-surface-4 text-text-secondary bg-surface-3 hover:border-accent hover:text-text-primary hover:bg-accent-soft',
                ].join(' ')}
              >
                {group.label}
                {/* chevron indicator */}
                <svg
                  width="10" height="10" viewBox="0 0 10 10" fill="none"
                  className={['transition-transform duration-150', isOpen ? 'rotate-180' : ''].join(' ')}
                >
                  <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              {/* Dropdown panel */}
              {isOpen && (
                <div className={[
                  'absolute top-full left-0 mt-1 z-50',
                  'bg-surface-2 border border-surface-4 rounded-input shadow-modal',
                  'flex flex-col py-1 min-w-[200px]',
                ].join(' ')}>
                  {group.templates.map(t => (
                    <button
                      key={t.label}
                      type="button"
                      title={t.hint}
                      onClick={() => handleSelect(t)}
                      className={[
                        'flex items-center justify-between gap-3 px-3 h-8 text-left',
                        'text-[12px] text-text-secondary hover:text-text-primary hover:bg-surface-3',
                        'transition-base duration-base',
                      ].join(' ')}
                    >
                      <span>{t.label}</span>
                      {t.requiresWorkDir && (
                        // subtle indicator that working dir needs to be set
                        <span className="text-[10px] text-warning/70 shrink-0">set dir</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
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
      className="w-10 h-10 flex items-center justify-center rounded-btn border border-surface-4 text-text-muted hover:text-text-primary hover:bg-surface-3 transition-base duration-base shrink-0">
      <FolderOpen size={13} />
    </button>
  )
}

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

function inputCls(hasError: boolean, multiline = false) {
  return [
    multiline ? 'px-3 py-2.5' : 'h-10 px-3',
    'text-[13px] bg-surface-3 rounded-input border text-text-primary w-full',
    'placeholder:text-text-muted outline-none transition-base duration-base',
    hasError ? 'border-danger' : 'border-surface-4 focus:border-accent',
  ].join(' ')
}
