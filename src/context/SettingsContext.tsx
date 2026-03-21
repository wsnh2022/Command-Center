import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import type { AppSettings } from '../types'
import { ipc } from '../utils/ipc'

interface SettingsContextValue {
  settings: AppSettings | null
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: null,
  updateSettings: async () => {},
})

const DEFAULT_SETTINGS: AppSettings = {
  theme:           'dark',
  fontSize:        'medium',
  density:         'comfortable',
  launchOnStartup: true,
  minimizeToTray:  true,
  webviewPosition: 'right',
  webviewWidth:    480,
  lastActiveGroup: '',
  globalShortcut:  'CommandOrControl+Shift+Space',
  hoverNavigate:       false,
  sidebarHeaderLabel:  'Groups',
  updatedAt:           '',
}

// Apply settings as data-* attributes on <html> so CSS vars respond immediately
function applyToDOM(settings: AppSettings): void {
  const root = document.documentElement
  root.setAttribute('data-theme',     settings.theme)
  root.setAttribute('data-font-size', settings.fontSize)
  root.setAttribute('data-density',   settings.density)
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings | null>(null)

  useEffect(() => {
    ipc.settings.get()
      .then(s => {
        setSettings(s)
        applyToDOM(s)
      })
      .catch(() => {
        // DB not ready yet — apply defaults so app renders with correct theme
        setSettings(DEFAULT_SETTINGS)
        applyToDOM(DEFAULT_SETTINGS)
      })
  }, [])

  // Keep the launchOnStartup toggle in sync when the user changes it via the
  // tray context menu (tray sends 'startup:changed' after writing to the OS).
  useEffect(() => {
    function onStartupChanged(enabled: unknown) {
      setSettings(prev =>
        prev ? { ...prev, launchOnStartup: Boolean(enabled) } : prev
      )
    }
    ipc.on('startup:changed', onStartupChanged)
    return () => ipc.off('startup:changed', onStartupChanged)
  }, [])

  async function updateSettings(patch: Partial<AppSettings>): Promise<void> {
    const updated = await ipc.settings.update(patch)
    setSettings(updated)
    applyToDOM(updated)
  }

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings(): SettingsContextValue {
  return useContext(SettingsContext)
}
