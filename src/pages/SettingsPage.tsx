/**
 * SettingsPage.tsx — Phase 9
 * All settings functional. Changes apply instantly app-wide via SettingsContext.
 *
 * Sections:
 *  1. Appearance  — theme, font size, density
 *  2. Behavior    — launch on startup, minimize to tray
 *  3. Webview     — default position
 *  4. Data        — link to Import/Export page
 */

import { Monitor, Power, PanelRight, Database, ChevronRight } from 'lucide-react'
import { useSettings } from '../context/SettingsContext'
import type { NavigateFn } from '../types/navigation'
import type { Theme, FontSize, Density } from '../types'

interface SettingsPageProps {
  navigate: NavigateFn
}

// ─── Shared sub-components ────────────────────────────────────────────────────

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
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  )
}


function SettingRow({ label, description, children }: {
  label: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-1 py-2">
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-[0.8rem] text-text-primary">{label}</span>
        {description && (
          <span className="text-[0.75rem] text-text-secondary leading-snug">{description}</span>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function SegmentedControl<T extends string>({ value, options, onChange }: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex rounded-btn border border-surface-4 overflow-hidden">
      {options.map((opt, i) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={[
            'px-3 h-7 text-[0.75rem] transition-base duration-base',
            i > 0 ? 'border-l border-surface-4' : '',
            value === opt.value
              ? 'bg-accent-soft text-text-primary font-medium'
              : 'text-text-secondary hover:text-text-primary hover:bg-surface-3',
          ].join(' ')}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}


function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={[
        'relative w-10 h-5 rounded-pill transition-base duration-base shrink-0',
        checked ? 'bg-accent' : 'bg-surface-4',
      ].join(' ')}
    >
      <span className={[
        'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-base duration-base',
        checked ? 'left-5' : 'left-0.5',
      ].join(' ')} />
    </button>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SettingsPage({ navigate }: SettingsPageProps) {
  const { settings, updateSettings } = useSettings()

  if (!settings) return null

  function set<K extends keyof typeof settings>(key: K, value: typeof settings[K]) {
    updateSettings({ [key]: value })
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">

      <div className="flex-shrink-0 px-6 pt-5 pb-4">
        <h1 className="text-lg font-semibold text-text-primary">Settings</h1>
        <p className="text-[0.75rem] text-text-secondary mt-0.5">Preferences and app configuration</p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-8">
        <div className="max-w-xl flex flex-col gap-8">


          <Section icon={Monitor} title="Appearance">
            <SettingRow label="Theme" description="Switch between dark and light mode">
              <SegmentedControl<Theme>
                value={settings.theme}
                options={[
                  { value: 'dark',  label: 'Dark'  },
                  { value: 'light', label: 'Light' },
                ]}
                onChange={v => set('theme', v)}
              />
            </SettingRow>
            <SettingRow label="Font size" description="Scales all text across the app">
              <SegmentedControl<FontSize>
                value={settings.fontSize}
                options={[
                  { value: 'medium', label: 'Default' },
                  { value: 'large',  label: 'Large'   },
                ]}
                onChange={v => set('fontSize', v)}
              />
            </SettingRow>
            <SettingRow label="Density" description="Controls card padding and item row height">
              <SegmentedControl<Density>
                value={settings.density}
                options={[
                  { value: 'comfortable', label: 'Comfortable' },
                  { value: 'compact',     label: 'Compact'     },
                ]}
                onChange={v => set('density', v)}
              />
            </SettingRow>
          </Section>

          <Section icon={Power} title="Behavior">
            <SettingRow
              label="Launch on startup"
              description="Start Command-Center automatically when Windows starts"
            >
              <Toggle checked={settings.launchOnStartup} onChange={v => set('launchOnStartup', v)} />
            </SettingRow>
            <SettingRow
              label="Minimize to tray"
              description="Keep Command-Center running in the system tray when window is closed"
            >
              <Toggle checked={settings.minimizeToTray} onChange={v => set('minimizeToTray', v)} />
            </SettingRow>
            <SettingRow
              label="Hover to navigate groups"
              description="Hovering over a sidebar group for 300ms navigates to it without clicking"
            >
              <Toggle checked={settings.hoverNavigate} onChange={v => set('hoverNavigate', v)} />
            </SettingRow>
          </Section>


          <Section icon={PanelRight} title="Webview">
            <SettingRow
              label="Panel position"
              description="Where the webview panel opens when launching a URL"
            >
              <SegmentedControl<'right' | 'bottom'>
                value={settings.webviewPosition}
                options={[
                  { value: 'right',  label: 'Right'  },
                  { value: 'bottom', label: 'Bottom' },
                ]}
                onChange={v => set('webviewPosition', v)}
              />
            </SettingRow>
          </Section>

          <Section icon={Database} title="Data">
            <button
              onClick={() => navigate({ type: 'import-export' })}
              className="flex items-center justify-between px-1 py-2 rounded-btn
                         hover:bg-surface-3 transition-base duration-base group w-full text-left"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-[0.8rem] text-text-primary">Backup &amp; Import / Export</span>
                <span className="text-[0.75rem] text-text-secondary">Manage backups, export data, restore from file</span>
              </div>
              <ChevronRight size={14} className="text-text-muted group-hover:text-text-primary transition-base duration-base shrink-0" />
            </button>
          </Section>

        </div>
      </div>
    </div>
  )
}
