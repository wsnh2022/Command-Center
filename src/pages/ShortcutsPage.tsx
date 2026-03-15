/**
 * ShortcutsPage.tsx — Phase 11
 * Lets the user view and remap the global show/hide shortcut.
 *
 * Flow:
 *  1. Load — fetches current accelerator from main via shortcuts:get
 *  2. Idle — displays the binding as key chips
 *  3. Recording — user clicks "Change", next keydown combo is captured
 *  4. Confirm — calls shortcuts:set; shows success or conflict error
 *  5. Reset — calls shortcuts:reset; restores default
 */

import { useState, useEffect, useCallback } from 'react'
import { Keyboard, RotateCcw, AlertTriangle } from 'lucide-react'
import { ipc } from '../utils/ipc'

const DEFAULT_ACCELERATOR = 'CommandOrControl+Shift+Space'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function acceleratorToChips(accelerator: string): string[] {
  return accelerator.split('+').map(part => {
    if (part === 'CommandOrControl' || part === 'Control' || part === 'Ctrl') return 'Ctrl'
    if (part === 'Command' || part === 'Meta') return 'Cmd'
    if (part === 'Alt') return 'Alt'
    if (part === 'Shift') return 'Shift'
    if (part === 'Space') return 'Space'
    return part
  })
}


function eventToAccelerator(e: KeyboardEvent): string | null {
  const parts: string[] = []
  if (e.ctrlKey)  parts.push('CommandOrControl')
  if (e.altKey)   parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  if (e.metaKey)  parts.push('Meta')
  if (parts.length === 0) return null
  const key = e.key
  if (key === ' ')                     parts.push('Space')
  else if (key === 'Escape')           return null
  else if (/^[A-Za-z]$/.test(key))    parts.push(key.toUpperCase())
  else if (/^\d$/.test(key))           parts.push(key)
  else if (/^F\d+$/.test(key))         parts.push(key)
  else if (key === 'Tab')              parts.push('Tab')
  else if (key === 'Enter')            parts.push('Return')
  else if (key === 'Backspace')        parts.push('Backspace')
  else if (key === 'Delete')           parts.push('Delete')
  else if (key === 'ArrowUp')          parts.push('Up')
  else if (key === 'ArrowDown')        parts.push('Down')
  else if (key === 'ArrowLeft')        parts.push('Left')
  else if (key === 'ArrowRight')       parts.push('Right')
  else if (key === ',')  parts.push(',')
  else if (key === '.')  parts.push('.')
  else if (key === '/')  parts.push('/')
  else if (key === ';')  parts.push(';')
  else if (key === "'")  parts.push("'")
  else if (key === '[')  parts.push('[')
  else if (key === ']')  parts.push(']')
  else if (key === '\\') parts.push('\\')
  else if (key === '-')  parts.push('-')
  else if (key === '=')  parts.push('=')
  else if (key === '`')  parts.push('`')
  else if (['Control','Alt','Shift','Meta'].includes(key)) return null
  else parts.push(key)
  return parts.join('+')
}

// ─── Key chip components ──────────────────────────────────────────────────────

function KeyChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center justify-center
                     min-w-[28px] h-7 px-2 rounded
                     border border-surface-4 bg-surface-2
                     text-[0.75rem] font-medium text-text-primary
                     font-mono shadow-[0_1px_0_0] shadow-surface-4">
      {label}
    </span>
  )
}

function KeyCombo({ accelerator }: { accelerator: string }) {
  const chips = acceleratorToChips(accelerator)
  return (
    <div className="flex items-center gap-1.5">
      {chips.map((chip, i) => <KeyChip key={i} label={chip} />)}
    </div>
  )
}

function StatusBadge({ type, message }: { type: 'success' | 'error'; message: string }) {
  return (
    <div className={[
      'flex items-center gap-2 px-3 py-2 rounded-input text-[0.75rem]',
      type === 'success' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger',
    ].join(' ')}>
      {type === 'error' && <AlertTriangle size={13} className="shrink-0" />}
      {message}
    </div>
  )
}


// ─── Main page ────────────────────────────────────────────────────────────────

export default function ShortcutsPage() {
  const [accelerator, setAccelerator] = useState<string | null>(null)
  const [recording,   setRecording]   = useState(false)
  const [preview,     setPreview]     = useState<string | null>(null)
  const [busy,        setBusy]        = useState(false)
  const [status,      setStatus]      = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  useEffect(() => {
    try {
      ipc.shortcuts.get()
        .then(res => setAccelerator(res.accelerator))
        .catch(() => setAccelerator(DEFAULT_ACCELERATOR))
    } catch {
      setAccelerator(DEFAULT_ACCELERATOR)
    }
  }, [])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.key === 'Escape') { setRecording(false); setPreview(null); return }
    const combo = eventToAccelerator(e)
    if (combo) setPreview(combo)
  }, [])

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    e.preventDefault()
    const combo = preview
    if (!combo) return
    setRecording(false)
    setPreview(null)
    applyShortcut(combo)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview])

  useEffect(() => {
    if (!recording) return
    window.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('keyup',   handleKeyUp,   true)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('keyup',   handleKeyUp,   true)
    }
  }, [recording, handleKeyDown, handleKeyUp])


  async function applyShortcut(combo: string) {
    setBusy(true)
    setStatus(null)
    try {
      const res = await ipc.shortcuts.set(combo)
      setAccelerator(res.accelerator)
      setStatus({ type: 'success', msg: 'Shortcut saved.' })
    } catch (e) {
      setStatus({ type: 'error', msg: e instanceof Error ? e.message : 'Failed to set shortcut.' })
    } finally {
      setBusy(false)
    }
  }

  async function handleReset() {
    setBusy(true)
    setStatus(null)
    try {
      const res = await ipc.shortcuts.reset()
      setAccelerator(res.accelerator)
      setStatus({ type: 'success', msg: 'Reset to default.' })
    } catch {
      setStatus({ type: 'error', msg: 'Failed to reset shortcut.' })
    } finally {
      setBusy(false)
    }
  }

  const isDefault = accelerator === DEFAULT_ACCELERATOR

  return (
    <div className="flex flex-col h-full overflow-hidden">

      <div className="flex-shrink-0 px-6 pt-5 pb-4">
        <h1 className="text-lg font-semibold text-text-primary">Keyboard Shortcuts</h1>
        <p className="text-[0.75rem] text-text-secondary mt-0.5">
          Configure the global shortcut to show or hide Command-Center from anywhere
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-8">
        <div className="max-w-lg flex flex-col gap-6">

          <div className="flex items-center gap-2 pb-2 border-b border-surface-4">
            <Keyboard size={14} className="text-text-muted shrink-0" />
            <h2 className="text-[0.68rem] font-semibold text-text-secondary uppercase tracking-[0.1em]">
              Global shortcut
            </h2>
          </div>

          <p className="text-[0.75rem] text-text-secondary leading-relaxed -mt-3">
            This shortcut works system-wide — even when Command-Center is hidden to the tray.
            Press it once to show the window, again to hide it.
          </p>


          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-4
                            px-4 py-3 rounded-card border border-surface-4 bg-surface-1">
              <div className="flex flex-col gap-1.5">
                <span className="text-[0.75rem] text-text-secondary font-medium">Show / hide Command-Center</span>
                {recording ? (
                  <div className="flex items-center gap-2">
                    {preview
                      ? <KeyCombo accelerator={preview} />
                      : <span className="text-[0.75rem] text-text-secondary animate-pulse">Press a key combination…</span>
                    }
                    <span className="text-[0.72rem] text-text-secondary ml-1">(Esc to cancel)</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {accelerator
                      ? <KeyCombo accelerator={accelerator} />
                      : <span className="text-[0.75rem] text-text-secondary">Loading…</span>
                    }
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!recording && !isDefault && (
                  <button
                    onClick={handleReset}
                    disabled={busy}
                    title="Reset to default"
                    className="flex items-center gap-1 px-2 h-7 rounded-btn text-[0.75rem]
                               border border-surface-4 text-text-secondary
                               hover:text-text-primary hover:border-accent/50
                               transition-base duration-base disabled:opacity-40"
                  >
                    <RotateCcw size={11} />
                    Reset
                  </button>
                )}
                <button
                  onClick={() => { setRecording(r => !r); setPreview(null); setStatus(null) }}
                  disabled={busy}
                  className={[
                    'px-3 h-7 rounded-btn text-[0.75rem] font-medium border transition-base duration-base disabled:opacity-40',
                    recording
                      ? 'border-danger text-danger hover:bg-danger/10'
                      : 'border-accent/60 text-accent hover:bg-accent/10',
                  ].join(' ')}
                >
                  {recording ? 'Cancel' : 'Change'}
                </button>
              </div>
            </div>

            {status && <StatusBadge type={status.type} message={status.msg} />}


            {/* Limitations note */}
            <div className="flex flex-col gap-1.5 px-3 py-2.5 rounded-input
                            border border-surface-4 bg-surface-1">
              <span className="text-[0.75rem] font-medium text-text-secondary uppercase tracking-[0.08em]">
                Combinations that won't work
              </span>
              <ul className="flex flex-col gap-1">
                {[
                  'Bare keys with no modifier (e.g. just F or Space)',
                  'Escape — reserved for cancelling the recording',
                  'Combos already claimed by Windows (e.g. Ctrl+Alt+Del, Win+L)',
                  'Single-modifier only (e.g. just Ctrl or just Shift alone)',
                ].map((note, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[0.75rem] text-text-secondary leading-snug">
                    <span className="mt-[4px] shrink-0 w-1 h-1 rounded-full bg-text-muted opacity-60" />
                    {note}
                  </li>
                ))}
              </ul>
            </div>

            {/* Allowed keys reference */}
            <div className="flex flex-col gap-0 rounded-input border border-surface-4 overflow-hidden">

              <div className="px-3 py-2 bg-surface-2 border-b border-surface-4">
                <span className="text-[0.75rem] font-medium text-text-secondary uppercase tracking-[0.08em]">
                  Allowed key types
                </span>
              </div>

              <div className="grid grid-cols-[100px_1fr_80px] gap-2 px-3 py-1.5
                              bg-surface-1 border-b border-surface-4">
                <span className="text-[0.72rem] font-medium text-text-secondary uppercase tracking-[0.08em]">Type</span>
                <span className="text-[0.72rem] font-medium text-text-secondary uppercase tracking-[0.08em]">Keys</span>
                <span className="text-[0.72rem] font-medium text-text-secondary uppercase tracking-[0.08em]">Needs modifier?</span>
              </div>


              {[
                { label: 'Modifiers',     sublabel: 'combine with others',  keys: ['Ctrl', 'Alt', 'Shift'],             rule: null  },
                { label: 'Letters',       sublabel: 'A – Z',                keys: ['A', 'B', 'Z', '…'],                 rule: true  },
                { label: 'Digits',        sublabel: '0 – 9',                keys: ['0', '1', '9', '…'],                 rule: true  },
                { label: 'Function keys', sublabel: 'F1 – F12',             keys: ['F1', 'F5', 'F12'],                  rule: false },
                { label: 'Special keys',  sublabel: '',                     keys: ['Space','Tab','Enter','Del','↑','↓'], rule: true  },
                { label: 'Symbols',       sublabel: 'punctuation',          keys: [',','.','/',';',"'","[","]",'\\','-','=','`'], rule: true },
              ].map(({ label, sublabel, keys, rule }, i, arr) => (
                <div key={label}
                  className={[
                    'grid grid-cols-[100px_1fr_80px] gap-2 px-3 py-2 items-start bg-surface-1',
                    i < arr.length - 1 ? 'border-b border-surface-4' : '',
                  ].join(' ')}
                >
                  <div className="pt-0.5">
                    <span className="text-[0.75rem] text-text-secondary font-medium">{label}</span>
                    {sublabel && <span className="block text-[0.72rem] text-text-secondary">{sublabel}</span>}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {keys.map(k => (
                      <span key={k}
                        className="inline-flex items-center justify-center
                                   min-w-[22px] h-[20px] px-1.5 rounded
                                   border border-surface-4 bg-surface-2
                                   text-[0.72rem] font-medium text-text-secondary font-mono
                                   shadow-[0_1px_0_0] shadow-surface-4">
                        {k}
                      </span>
                    ))}
                  </div>
                  <div className="pt-0.5">
                    {rule === null  && <span className="text-[0.72rem] text-text-secondary italic">they are the modifier</span>}
                    {rule === true  && (
                      <span className="inline-flex items-center gap-1 text-[0.72rem] font-medium text-warning">
                        <span className="w-1 h-1 rounded-full bg-warning shrink-0" />Required
                      </span>
                    )}
                    {rule === false && (
                      <span className="inline-flex items-center gap-1 text-[0.72rem] font-medium text-success">
                        <span className="w-1 h-1 rounded-full bg-success shrink-0" />Optional
                      </span>
                    )}
                  </div>
                </div>
              ))}

              <div className="px-3 py-2 bg-surface-2 border-t border-surface-4">
                <span className="text-[0.72rem] text-text-secondary leading-snug">
                  Examples:{' '}
                  <span className="font-mono">Ctrl+,</span> ·{' '}
                  <span className="font-mono">Alt+F4</span> ·{' '}
                  <span className="font-mono">Ctrl+Shift+.</span> ·{' '}
                  <span className="font-mono">F9</span> ·{' '}
                  <span className="font-mono">Ctrl+Shift+F1</span>
                </span>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
