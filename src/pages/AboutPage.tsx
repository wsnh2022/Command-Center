/**
 * AboutPage.tsx - Phase 13
 *
 * Sections:
 *  1. App - name, version, build date, tagline
 *  2. Tech stack - key dependencies with versions
 *  3. Data - storage location, DB path info
 *  4. Credits - author, open source acknowledgment
 */

import type React from 'react'
import { Info, Package, HardDrive, Heart, ExternalLink } from 'lucide-react'
import { ipc } from '../utils/ipc'

// ─── Sub-components (mirrors SettingsPage layout patterns) ────────────────────

function Section({ icon: Icon, title, children }: {
  icon: React.ElementType
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 pb-2 border-b border-surface-4">
        <Icon size={14} className="text-text-muted shrink-0" />
        {/* tracking-[0.1em] = slightly tighter than Tailwind's tracking-wider (0.05em default) - more refined */}
        <h2 className="text-[0.68rem] font-semibold text-text-secondary uppercase tracking-[0.1em]">{title}</h2>
      </div>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  )
}

function InfoRow({ label, value, mono = false }: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-1 py-2.5">
      {/* text-[0.8rem] - slightly above Tailwind text-xs (0.75rem) for better legibility */}
      <span className="text-[0.8rem] text-text-secondary">{label}</span>
      <span
        className={[
          'text-[0.8rem] text-text-primary shrink-0',
          mono ? 'font-mono text-[0.72rem]' : '',  /* mono paths: scale with root, not locked to px */
        ].join(' ')}
      >
        {value}
      </span>
    </div>
  )
}


function LinkRow({ label, description, href }: {
  label: string
  description: string
  href: string
}) {
  return (
    <button
      onClick={() => ipc.system.openExternal(href)}
      className="flex items-center justify-between gap-4 px-1 py-2.5 rounded-btn w-full text-left
                 hover:bg-surface-3 transition-colors duration-fast group"
    >
      <div className="flex flex-col gap-1 min-w-0">
        {/* text-[0.8rem] matches InfoRow label weight - consistent row height */}
        <span className="text-[0.8rem] text-text-primary">{label}</span>
        {/* description: text-secondary (not muted) + no truncate - URL must be readable */}
        <span className="text-[0.72rem] text-text-secondary leading-snug break-all">{description}</span>
      </div>
      <ExternalLink
        size={13}
        className="text-text-muted group-hover:text-text-primary transition-colors duration-fast shrink-0"
      />
    </button>
  )
}

// ─── Constants ────────────────────────────────────────────────────────────────

const APP_VERSION   = '0.1.0-beta'
const BUILD_DATE    = '2026-03-21'
const AUTHOR        = 'wsnh2022'
const RELEASES_URL  = 'https://github.com/wsnh2022/command-center/releases'
const REPO_URL      = 'https://github.com/wsnh2022/command-center'

const STACK: { name: string; version: string; purpose: string }[] = [
  { name: 'Electron',        version: '30',      purpose: 'Desktop shell' },
  { name: 'React',           version: '18',      purpose: 'UI framework'  },
  { name: 'better-sqlite3',  version: '9',       purpose: 'Local database' },
  { name: 'Tailwind CSS',    version: '3',       purpose: 'Styling'       },
  { name: 'fuse.js',         version: '7',       purpose: 'Fuzzy search'  },
  { name: 'lucide-react',    version: '0.378',   purpose: 'Icons'         },
  { name: '@dnd-kit',        version: '6 / 8',   purpose: 'Drag & drop'   },
  { name: 'Vite',            version: '5',       purpose: 'Build tool'    },
]


// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AboutPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Page header */}
      <div className="flex-shrink-0 px-6 pt-5 pb-4">
        <h1 className="text-lg font-semibold text-text-primary">About</h1>
        <p className="text-[0.75rem] text-text-secondary mt-0.5">Version info, tech stack, and credits</p>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-6 pb-8">
        <div className="max-w-xl flex flex-col gap-8">

          {/* ── App ──────────────────────────────────────────────────────── */}
          <Section icon={Info} title="App">

            {/* Logo + tagline */}
            <div className="flex items-center gap-3 px-1 py-3">
              {/* w-11 h-11 - slightly larger than before, proportionate to text-base name */}
              <div
                className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0 shadow-card"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                <span className="text-white text-[0.9rem] font-bold tracking-tight">CD</span>
              </div>
              <div>
                {/* text-base (1rem) - up from text-sm (0.875rem) for a proper hero feel */}
                <p className="text-base font-semibold text-text-primary">Command-Center</p>
                <p className="text-[0.75rem] text-text-secondary">Personal Windows desktop control center · Beta</p>
              </div>
            </div>


            <div
              className="rounded-card overflow-hidden"
              style={{ border: '1px solid var(--surface-4)' }}
            >
              <InfoRow label="Version"    value={APP_VERSION} />
              <div style={{ borderTop: '1px solid var(--surface-4)' }}>
                <InfoRow label="Build date" value={BUILD_DATE} />
              </div>
              <div style={{ borderTop: '1px solid var(--surface-4)' }}>
                <InfoRow label="Platform"   value="Windows (x64)" />
              </div>
            </div>

            <LinkRow
              label="Check for updates"
              description={RELEASES_URL}
              href={RELEASES_URL}
            />

          </Section>

          {/* ── Tech stack ───────────────────────────────────────────────── */}
          <Section icon={Package} title="Tech stack">
            <div
              className="rounded-card overflow-hidden"
              style={{ border: '1px solid var(--surface-4)' }}
            >
              {STACK.map((dep, i) => (
                <div
                  key={dep.name}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                  style={i > 0 ? { borderTop: '1px solid var(--surface-4)' } : undefined}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {/* text-[0.8rem] - up from text-xs (0.75rem), matches InfoRow label */}
                    <span className="text-[0.8rem] font-mono text-text-primary">{dep.name}</span>
                    {/* badge: 0.7rem scales with root - no more hardcoded 10px minimum */}
                    <span
                      className="text-[0.7rem] px-2 py-0.5 rounded shrink-0"
                      style={{
                        backgroundColor: 'var(--surface-3)',
                        color: 'var(--text-secondary)',  /* text-secondary not muted - clearly readable */
                      }}
                    >
                      v{dep.version}
                    </span>
                  </div>
                  {/* purpose: text-secondary (not muted) - this is info, not decoration */}
                  <span className="text-[0.75rem] text-text-secondary shrink-0">{dep.purpose}</span>
                </div>
              ))}
            </div>
          </Section>


          {/* ── Data ─────────────────────────────────────────────────────── */}
          <Section icon={HardDrive} title="Data">
            <InfoRow
              label="Database"
              value="%APPDATA%\\Command-Center\\command-center.db"
              mono
            />
            <InfoRow
              label="Backups"
              value="%APPDATA%\\Command-Center\\backups\\"
              mono
            />
            <InfoRow
              label="Icons"
              value="%APPDATA%\\Command-Center\\assets\\"
              mono
            />
          </Section>

          {/* ── Credits ──────────────────────────────────────────────────── */}
          <Section icon={Heart} title="Credits">

            <div className="px-1 py-2 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[0.8rem] text-text-secondary">Author</span>
                <span className="text-[0.8rem] text-text-primary font-medium">{AUTHOR}</span>
              </div>
              <p className="text-[0.75rem] text-text-secondary leading-relaxed">
                Built with Electron, React, and SQLite. Icons by Lucide.
                Drag and drop via @dnd-kit. Fuzzy search by fuse.js.
              </p>
            </div>

            <LinkRow
              label="Source code"
              description={REPO_URL}
              href={REPO_URL}
            />

          </Section>

        </div>
      </div>
    </div>
  )
}
