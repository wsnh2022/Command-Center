/**
 * launch.service.ts
 *
 * Canonical home for all item launch logic.
 * Exports:
 *   launchItem(item) — routes launch by item type, returns { success: boolean }
 *
 * Supported types: url, software, folder, command
 * Action type removed — system actions are now set up as Command items.
 */

import { shell } from 'electron'
import { spawn } from 'child_process'
import { sanitizePath, sanitizeUrl } from '../utils/sanitize'
import type { Item } from '../../src/types'

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
    await shell.openExternal(safeUrl)
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

    const cwd = item.workingDir
      ? sanitizePath(item.workingDir) || process.env['USERPROFILE']
      : process.env['USERPROFILE']

    const rawArgs = item.commandArgs?.trim() ?? ''

    // Use cmd.exe /c start to launch the target in its own independent window.
    // This is the correct Windows pattern for detached visible terminals.
    //
    // Why not spawn(cmd, args, { shell: true })?
    // shell:true wraps the call as: cmd /d /s /c "your command"
    // That CMD process owns the window — when the inner process exits, the
    // window closes. /c start hands ownership to a new independent process so
    // the window persists correctly.
    //
    // The empty first arg after 'start' is the window title (required when the
    // next token starts with a quote, otherwise start misparses it as the title).
    const startArgs = rawArgs
      ? ['/c', 'start', '', cmd, rawArgs]
      : ['/c', 'start', '', cmd]

    const p = spawn('cmd.exe', startArgs, {
      cwd,
      detached: true,
      stdio: 'ignore',
      shell: false,          // no wrapper — cmd.exe is called directly
    })
    p.unref()
    success = true
  }

  return { success }
}
