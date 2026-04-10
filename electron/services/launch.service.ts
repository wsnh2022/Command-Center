/**
 * launch.service.ts
 *
 * Canonical home for all item launch logic.
 * Exports:
 *   launchItem(item) - routes launch by type, returns { success: boolean }
 *
 * Supported types: url, software, folder, command
 * Action type removed - system actions are now set up as Command items.
 */

import { shell } from 'electron'
import { spawn } from 'child_process'
import { sanitizePath, sanitizeUrl } from '../utils/sanitize'
import type { Item } from '../../src/types'

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

    // PowerShell: spawn directly - cmd.exe /c start causes Access Denied
    // when launching .ps1 scripts due to UAC session boundary restrictions.
    // shell: true opens a visible console window without needing start.
    const isPs = /^powershell(\.exe)?$/i.test(cmd)

    if (isPs) {
      const psArgs = rawArgs ? rawArgs.split(/\s+/).filter(Boolean) : []
      const p = spawn(cmd, psArgs, {
        cwd,
        detached: true,
        stdio:    'ignore',
        shell:    true,   // shell:true opens a visible console window
      })
      p.unref()
      success = true
      return { success }
    }

    // All other commands: cmd.exe /c start for an independent visible window.
    const startArgs = rawArgs
      ? ['/c', 'start', '', cmd, rawArgs]
      : ['/c', 'start', '', cmd]

    const p = spawn('cmd.exe', startArgs, {
      cwd,
      detached: true,
      stdio:    'ignore',
      shell:    false,
    })
    p.unref()
    success = true
  }

  return { success }
}
