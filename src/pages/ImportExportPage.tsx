/**
 * ImportExportPage.tsx - Phase 10
 * Backup snapshots, export and import for Command-Center data.
 *
 * Sections:
 *  1. Snapshots    - list of auto-backups, restore any snapshot
 *  2. Export       - export full ZIP (DB + assets) to user-chosen path
 *  3. Import       - import ZIP, replaces all data
 */

import { useState, useEffect, useCallback } from 'react'
import { Save, Upload, RotateCcw, Database, AlertTriangle } from 'lucide-react'
import { ipc } from '../utils/ipc'
import ConfirmDialog from '../components/ui/ConfirmDialog'

interface SnapshotInfo {
  filename:  string
  timestamp: string
  sizeBytes: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024)        return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}


function formatTimestamp(raw: string): string {
  try {
    const iso = raw.replace(/T(\d{2})-(\d{2})-(\d{2})/, 'T$1:$2:$3')
    const d = new Date(iso)
    if (isNaN(d.getTime())) return raw
    return d.toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
  } catch {
    return raw
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ icon: Icon, title, children }: {
  icon: React.ElementType
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 pb-2 border-b border-surface-4">
        <Icon size={14} className="text-text-muted shrink-0" />
        <h2 className="text-[0.68rem] font-semibold text-text-secondary uppercase tracking-[0.1em]">{title}</h2>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  )
}

function StatusBadge({ type, message }: { type: 'success' | 'error'; message: string }) {
  return (
    <div className={[
      'flex items-center gap-2 px-3 py-2 rounded-input text-[0.75rem]',
      type === 'success'
        ? 'bg-success/10 text-success'
        : 'bg-danger/10 text-danger',
    ].join(' ')}>
      {type === 'error' && <AlertTriangle size={13} className="shrink-0" />}
      {message}
    </div>
  )
}


// ─── Snapshots section ────────────────────────────────────────────────────────

const INITIAL_ROWS = 5

function SnapshotsSection() {
  const [snapshots,      setSnapshots]      = useState<SnapshotInfo[]>([])
  const [loading,        setLoading]        = useState(true)
  const [restoring,      setRestoring]      = useState<string | null>(null)
  const [pendingRestore, setPendingRestore] = useState<string | null>(null)
  const [status,         setStatus]         = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [expanded,       setExpanded]       = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const list = await ipc.backup.listSnapshots()
      setSnapshots(list)
    } catch {
      setStatus({ type: 'error', msg: 'Failed to load snapshots' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function handleRestore(filename: string) { setPendingRestore(filename) }

  async function executeRestore() {
    if (!pendingRestore) return
    const filename = pendingRestore
    setPendingRestore(null)
    setRestoring(filename)
    setStatus(null)
    try {
      await ipc.backup.restoreSnapshot(filename)
      setStatus({ type: 'success', msg: 'Snapshot restored. Reloading app…' })
      setTimeout(() => window.location.reload(), 1500)
    } catch (e) {
      setStatus({ type: 'error', msg: e instanceof Error ? e.message : 'Restore failed' })
    } finally {
      setRestoring(null)
    }
  }

  const visibleCount = expanded ? snapshots.length : INITIAL_ROWS * 2
  const visible      = snapshots.slice(0, visibleCount)
  const hasMore      = snapshots.length > INITIAL_ROWS * 2
  const leftCol      = visible.filter((_, i) => i % 2 === 0)
  const rightCol     = visible.filter((_, i) => i % 2 === 1)


  return (
    <Section icon={Database} title="Auto-Backups">
      <p className="text-[0.75rem] text-text-secondary leading-relaxed">
        Command-Center automatically backs up your data after every change.
        Up to 10 snapshots are kept - oldest are removed automatically.
      </p>

      {status && <StatusBadge type={status.type} message={status.msg} />}

      {loading && (
        <span className="text-[0.75rem] text-text-secondary px-1">Loading snapshots…</span>
      )}

      {!loading && snapshots.length === 0 && (
        <div className="px-3 py-6 rounded-card border border-surface-4 text-center">
          <span className="text-[0.75rem] text-text-secondary">
            No snapshots yet. Snapshots are created automatically when you add or edit data.
          </span>
        </div>
      )}

      {!loading && snapshots.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-1.5">
            {[leftCol, rightCol].map((col, colIdx) => (
              <div key={colIdx} className="flex flex-col gap-1.5">
                {col.map(snap => (
                  <div key={snap.filename}
                    className="flex flex-col gap-1 px-3 py-2 rounded-btn
                               border border-surface-4 bg-surface-3
                               hover:border-accent/40 transition-base duration-base"
                  >
                    <span className="text-[0.75rem] text-text-primary font-medium leading-snug">
                      {formatTimestamp(snap.timestamp)}
                    </span>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[0.72rem] text-text-secondary">{formatBytes(snap.sizeBytes)}</span>
                      <button
                        onClick={() => handleRestore(snap.filename)}
                        disabled={!!restoring}
                        title="Restore this snapshot"
                        className="flex items-center gap-1 px-2 h-5 rounded-btn text-[0.72rem]
                                   border border-surface-4 text-text-secondary
                                   hover:text-text-primary hover:border-accent/60 hover:bg-surface-2
                                   transition-base duration-base disabled:opacity-40 shrink-0"
                      >
                        <RotateCcw size={9} />
                        {restoring === snap.filename ? 'Restoring…' : 'Restore'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {hasMore && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="self-start flex items-center gap-1.5 text-[0.75rem] text-text-secondary
                         hover:text-text-primary transition-base duration-base mt-0.5"
            >
              <span className="text-[0.72rem]">{expanded ? '▲' : '▼'}</span>
              {expanded ? 'Show less' : `Show all ${snapshots.length} snapshots`}
            </button>
          )}
        </>
      )}

      {pendingRestore && (
        <ConfirmDialog
          title="Restore snapshot?"
          message={`Restore to: ${formatTimestamp(pendingRestore.replace('command-center-', '').replace('.db', ''))}`}
          detail="Current data will be replaced. A backup of your current state is made first."
          confirmLabel="Restore" cancelLabel="Cancel" variant="info"
          onConfirm={executeRestore}
          onCancel={() => setPendingRestore(null)}
        />
      )}
    </Section>
  )
}


// ─── Export section ───────────────────────────────────────────────────────────

function ExportSection() {
  const [busy,   setBusy]   = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  async function handleExport() {
    setStatus(null)
    const today = new Date().toISOString().slice(0, 10)
    const destPath = await ipc.system.showSaveDialog({
      title:       'Export Command-Center Data',
      defaultPath: `command-center-export-${today}.zip`,
      filters:     [{ name: 'ZIP Archive', extensions: ['zip'] }],
    })
    if (!destPath) return
    setBusy(true)
    try {
      await ipc.backup.export(destPath)
      setStatus({ type: 'success', msg: `Exported successfully to ${destPath}` })
    } catch (e) {
      setStatus({ type: 'error', msg: e instanceof Error ? e.message : 'Export failed' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Section icon={Save} title="Export">
      <p className="text-[0.75rem] text-text-secondary leading-relaxed">
        Export all your groups, cards, items, and icons as a single ZIP file.
        Use this to back up your data or move it to another machine.
      </p>
      {status && <StatusBadge type={status.type} message={status.msg} />}
      <button
        onClick={handleExport}
        disabled={busy}
        className="self-start flex items-center gap-2 px-4 h-8 rounded-btn text-[0.75rem] font-medium
                   bg-accent text-text-inverse hover:bg-accent-hover
                   transition-base duration-base disabled:opacity-50"
      >
        <Save size={13} />
        {busy ? 'Exporting…' : 'Export to ZIP'}
      </button>
    </Section>
  )
}


// ─── Import section ───────────────────────────────────────────────────────────

function ImportSection() {
  const [busy,        setBusy]        = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [status,      setStatus]      = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  async function executeImport() {
    setShowConfirm(false)
    setStatus(null)
    const zipPath = await ipc.system.showOpenDialog({
      type:    'file',
      title:   'Import Command-Center Data',
      filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
    })
    if (!zipPath) return
    setBusy(true)
    try {
      await ipc.backup.import(zipPath)
      setStatus({ type: 'success', msg: 'Import complete. Reloading app…' })
    } catch (e) {
      setStatus({ type: 'error', msg: e instanceof Error ? e.message : 'Import failed' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Section icon={Upload} title="Import">
      <p className="text-[0.75rem] text-text-secondary leading-relaxed">
        Import data from a previously exported ZIP file.
        This will replace all current data. A backup of your current data is made automatically before import.
      </p>
      <div className="flex items-start gap-2 px-3 py-2 rounded-input bg-warning/10 border border-warning/20">
        <AlertTriangle size={13} className="text-warning shrink-0 mt-0.5" />
        <span className="text-[0.75rem] text-warning leading-snug">
          Destructive operation. All current groups, cards, and items will be replaced.
        </span>
      </div>
      {status && <StatusBadge type={status.type} message={status.msg} />}
      <button
        onClick={() => setShowConfirm(true)}
        disabled={busy}
        className="self-start flex items-center gap-2 px-4 h-8 rounded-btn text-[0.75rem] font-medium
                   border border-danger text-danger hover:bg-danger/10
                   transition-base duration-base disabled:opacity-50"
      >
        <Upload size={13} />
        {busy ? 'Importing…' : 'Import from ZIP'}
      </button>
      {showConfirm && (
        <ConfirmDialog
          title="Replace all data?"
          message="Import will replace ALL current groups, cards, and items."
          detail="A backup of your current data is made automatically before import proceeds."
          confirmLabel="Choose file & import" cancelLabel="Cancel" variant="danger"
          onConfirm={executeImport}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </Section>
  )
}


// ─── Main page ────────────────────────────────────────────────────────────────

export default function ImportExportPage() {
  useEffect(() => {
    const handler = () => { window.location.reload() }
    ipc.on('backup:importComplete', handler)
    return () => { ipc.off('backup:importComplete', handler) }
  }, [])

  return (
    <div className="flex flex-col h-full overflow-hidden">

      <div className="flex-shrink-0 px-6 pt-5 pb-4">
        <h1 className="text-lg font-semibold text-text-primary">Backup &amp; Import / Export</h1>
        <p className="text-[0.75rem] text-text-secondary mt-0.5">
          Manage your data snapshots, export backups, and restore from files
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-8">
        <div className="max-w-xl flex flex-col gap-8">
          <SnapshotsSection />
          <ExportSection />
          <ImportSection />
        </div>
      </div>

    </div>
  )
}
