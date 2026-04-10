import { app } from 'electron'
import { join } from 'path'
import { mkdirSync } from 'fs'

// Root user data dir - %APPDATA%\Command-Center on Windows
const USER_DATA = app.getPath('userData')

export const Paths = {
  userData:      USER_DATA,
  db:            join(USER_DATA, 'command-center.db'),
  backups:       join(USER_DATA, 'backups'),
  assetsDir:     join(USER_DATA, 'assets'),
  iconsDir:      join(USER_DATA, 'assets', 'icons'),
  faviconsDir:   join(USER_DATA, 'assets', 'favicons'),
} as const

// Ensure all required directories exist on first access
export function ensureDirectories(): void {
  for (const dir of [Paths.backups, Paths.iconsDir, Paths.faviconsDir]) {
    mkdirSync(dir, { recursive: true }) // no-op if already exists
  }
}
