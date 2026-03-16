/**
 * startup.service.ts
 *
 * Manages the Windows "Launch at Startup" shortcut in the user's Startup folder.
 *
 * WHY NOT app.setLoginItemSettings():
 *   This app ships both NSIS and portable builds.  The portable format is a
 *   self-extracting archive — electron-builder extracts it to a temp folder at
 *   runtime, so process.execPath points to the temp copy (gone after close).
 *   app.setLoginItemSettings() uses process.execPath, making the registry entry
 *   point at a path that no longer exists after the first run.
 *
 *   The correct approach for all build types is a .lnk shortcut in:
 *     %APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\
 *
 *   For portable builds, process.env.PORTABLE_EXECUTABLE_FILE (set automatically
 *   by electron-builder) points to the actual .exe on disk.  For NSIS installs,
 *   that env var is undefined and process.execPath is correct.
 *
 * ENCODING:
 *   PowerShell -EncodedCommand requires UTF-16LE base64.  Never use -Command with
 *   inline strings — Windows paths with spaces/backslashes will silently break.
 */

import { app } from 'electron'
import { execSync } from 'child_process'
import { existsSync, unlinkSync } from 'fs'
import { join, dirname } from 'path'

// Stable shortcut name — must NEVER include a version number.
// Changing this name leaves an orphaned shortcut in the user's Startup folder.
const SHORTCUT_NAME = 'Command-Center'

/** Absolute path to the .lnk file in the Windows Startup folder. */
function getShortcutPath(): string {
  return join(
    app.getPath('appData'),
    'Microsoft',
    'Windows',
    'Start Menu',
    'Programs',
    'Startup',
    `${SHORTCUT_NAME}.lnk`,
  )
}

/**
 * Reads the OS Startup folder — this is always the source of truth.
 * Never read from the database or any app-level store.
 */
export function getStartupEnabled(): boolean {
  return existsSync(getShortcutPath())
}

/**
 * Creates or removes the .lnk shortcut in the Windows Startup folder.
 *
 * @throws if PowerShell fails (caller should catch and surface to the UI)
 */
export function setStartupEnabled(enabled: boolean): void {
  if (process.platform !== 'win32') return   // graceful no-op on non-Windows

  const shortcutPath = getShortcutPath()

  if (enabled) {
    // PORTABLE_EXECUTABLE_FILE → the actual .exe the user runs (set by electron-builder)
    // process.execPath on a portable build → temp extraction folder, gone after close
    const exePath = process.env['PORTABLE_EXECUTABLE_FILE'] || process.execPath

    // Build the PowerShell script as a plain string — no escaping needed because
    // we base64-encode the entire script before passing it to PowerShell.
    const ps = [
      `$ws = New-Object -ComObject WScript.Shell`,
      `$s = $ws.CreateShortcut('${shortcutPath}')`,
      `$s.TargetPath = '${exePath}'`,
      `$s.WorkingDirectory = '${dirname(exePath)}'`,
      `$s.Save()`,
    ].join('; ')

    // -EncodedCommand requires UTF-16LE — any other encoding produces garbage
    const encoded = Buffer.from(ps, 'utf16le').toString('base64')
    execSync(`powershell -NoProfile -NonInteractive -EncodedCommand ${encoded}`)
  } else {
    if (existsSync(shortcutPath)) unlinkSync(shortcutPath)
  }
}
