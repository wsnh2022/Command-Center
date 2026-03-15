/**
 * launch.service.ts — Phase 13 extraction
 *
 * Canonical home for all item launch logic.
 * Extracted from items.ipc.ts where it was built inline during Phase 4.
 *
 * Exports:
 *   launchItem(item) — routes launch by item type, returns { success: boolean }
 *
 * items.ipc.ts:launch handler is now a 5-line delegate to launchItem().
 *
 * Session 27: stripped to 10 survivor actions. psWinCombo + VK removed.
 * Full power-user list replaces these in Session 28.
 */

import { shell } from 'electron'
import { spawn } from 'child_process'
import { openWebview } from '../ipc/webview.ipc'
import { sanitizePath, sanitizeUrl } from '../utils/sanitize'
import type { Item } from '../../src/types'

// --- Low-level process helpers -----------------------------------------------

/** Spawns a process detached and unreffed — fire-and-forget. */
function detach(cmd: string, args: string[] = []): void {
  const p = spawn(cmd, args, { detached: true, stdio: 'ignore' })
  p.unref()
}

/** Runs a PowerShell -Command string hidden — fire-and-forget. */
function psRun(command: string): void {
  const p = spawn(
    'powershell',
    ['-NonInteractive', '-WindowStyle', 'Hidden', '-Command', command],
    { detached: true, stdio: 'ignore' },
  )
  p.unref()
}

/**
 * Routes a custom action string to the correct execution mechanism.
 *
 * Priority order:
 * 1. shell: / ms-settings: / ms-*: / https?: URIs
 *    → shell.openExternal() — Electron hands directly to Windows shell handler.
 *      Most reliable for shell namespace paths (shell:startup, shell:sendto etc.)
 *      and ms-settings: deep links. PowerShell cannot handle these natively.
 *
 * 2. .exe / .bat / .cmd paths
 *    → detach() — direct spawn, no shell wrapper overhead.
 *
 * 3. .msc / .cpl paths
 *    → shell.openPath() — Windows opens them via their registered handler
 *      (MMC for .msc, rundll32 for .cpl).
 *
 * 4. Everything else (PowerShell expressions, COM objects, cmdlets)
 *    → psRun() — powershell -Command, same as built-in actions.
 */
async function routeCustom(cmd: string): Promise<void> {
  // URI schemes handled natively by Windows shell
  if (/^(shell:|ms-[a-z\-]+:|https?:|ftp:)/i.test(cmd)) {
    await shell.openExternal(cmd)
    return
  }

  // Executable file extensions — spawn directly
  if (/\.(exe|bat|cmd)(\s|$)/i.test(cmd)) {
    const parts = cmd.split(/\s+/)
    detach(parts[0], parts.slice(1))
    return
  }

  // MMC snap-ins and control panel items — let Windows open via registered handler
  if (/\.(msc|cpl)(\s|$)/i.test(cmd)) {
    await shell.openPath(cmd.split(/\s+/)[0])
    return
  }

  // PowerShell expression, COM command, or anything else
  psRun(cmd)
}

// --- Action dispatch ----------------------------------------------------------

/**
 * Dispatches a predefined Windows action or custom shell command.
 * Returns true if action was dispatched (even if background process fails).
 */
async function dispatchAction(actionId: string, customCmd: string): Promise<boolean> {
  switch (actionId) {
    // -- Direct exe launches ---------------------------------------------------
    case 'screenshot':         detach('SnippingTool.exe');                                           break
    case 'lock_screen':        detach('rundll32', ['user32.dll,LockWorkStation']);                   break
    case 'sleep':              detach('rundll32', ['powrprof.dll,SetSuspendState', '0', '1', '0']); break
    case 'shut_down':          detach('shutdown', ['/s', '/t', '0']);                               break
    case 'restart':            detach('shutdown', ['/r', '/t', '0']);                               break
    case 'task_manager':       detach('Taskmgr.exe');                                               break
    case 'calculator':         detach('calc.exe');                                                  break

    // -- shell.openExternal for ms-settings: URIs ------------------------------
    case 'clipboard':          await shell.openExternal('ms-settings:clipboard');                   break

    // -- PowerShell COM / shell utility commands -------------------------------
    case 'empty_recycle_bin':  psRun('Clear-RecycleBin -Force');                                    break
    case 'run':                psRun('(New-Object -ComObject WScript.Shell).Run("rundll32 shell32.dll,#61")'); break

    // -- Custom action ---------------------------------------------------------
    case 'custom': {
      const cmd = customCmd.trim()
      if (!cmd) return false
      await routeCustom(cmd)
      break
    }

    default: return false
  }
  return true
}

// --- Public API --------------------------------------------------------------

/**
 * Launches an item by type. Returns { success: boolean }.
 * Does NOT record recents or increment launch count — that stays in the IPC handler
 * so the service remains pure (no DB dependency).
 */
export async function launchItem(item: Item): Promise<{ success: boolean }> {
  let success = false

  if (item.type === 'url') {
    const safeUrl = sanitizeUrl(item.path) || item.path
    const openedInWebview = openWebview(safeUrl)
    if (!openedInWebview) await shell.openExternal(safeUrl)
    success = true

  } else if (item.type === 'software') {
    const safePath = sanitizePath(item.path)
    if (!safePath) throw new Error('Invalid software path')
    const err = await shell.openPath(safePath)
    success = !err

  } else if (item.type === 'folder') {
    const safePath = sanitizePath(item.path)
    if (!safePath) throw new Error('Invalid folder path')
    const err = await shell.openPath(safePath)
    success = !err

  } else if (item.type === 'command') {
    const cmd = sanitizePath(item.path)
    if (!cmd) throw new Error('Invalid command')
    const cwd  = item.workingDir ? sanitizePath(item.workingDir) || undefined : undefined
    const args = item.commandArgs ? item.commandArgs.split(/\s+/).filter(Boolean) : []
    const p = spawn(cmd, args, { cwd, detached: true, stdio: 'ignore', shell: true })
    p.unref()
    success = true

  } else if (item.type === 'action') {
    success = await dispatchAction(item.actionId, item.path)
  }

  return { success }
}
