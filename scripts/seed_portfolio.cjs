#!/usr/bin/env node
/**
 * seed_portfolio.cjs
 *
 * Populates Command-Center with the TASK_1_PORTFOLIO_SETUP groups, cards, and items.
 * Connects directly to the live SQLite database — no app needs to be running.
 *
 * Usage (from project root):
 *   node scripts/seed_portfolio.cjs
 *
 * Safe to re-run: skips any group/card/item whose name already exists under the same parent.
 * Close Command-Center before running (WAL checkpoint), then restart it after.
 */

'use strict'

const os   = require('os')
const path = require('path')
const { randomUUID } = require('crypto')

// ── resolve DB path ───────────────────────────────────────────────────────────
const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
const dbPath  = path.join(appData, 'Command-Center', 'command-center.db')

// ── load better-sqlite3 from project node_modules ────────────────────────────
let Database
try {
  Database = require(path.join(__dirname, '..', 'node_modules', 'better-sqlite3'))
} catch (e) {
  console.error('Cannot load better-sqlite3. Run this script from the project root.\n', e.message)
  process.exit(1)
}

console.log(`Connecting to: ${dbPath}\n`)
const db = new Database(dbPath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

const now = () => new Date().toISOString()

// ── order helpers ─────────────────────────────────────────────────────────────
const nextGroupOrder = () =>
  db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM groups').get().n

const nextCardOrder = (groupId) =>
  db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM cards WHERE group_id = ?').get(groupId).n

const nextItemOrder = (cardId) =>
  db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM items WHERE card_id = ?').get(cardId).n

// ── insert helpers ────────────────────────────────────────────────────────────
function upsertGroup({ name, icon, iconSource, iconColor, accentColor }) {
  const existing = db.prepare('SELECT id FROM groups WHERE name = ?').get(name)
  if (existing) {
    console.log(`  skip  group "${name}"`)
    return existing.id
  }
  const id = randomUUID()
  db.prepare(`
    INSERT INTO groups (id, name, icon, icon_source, icon_color, accent_color, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, icon, iconSource, iconColor, accentColor, nextGroupOrder(), now(), now())
  console.log(`  +     group "${name}"`)
  return id
}

function upsertCard({ groupId, name }) {
  const existing = db.prepare('SELECT id FROM cards WHERE group_id = ? AND name = ?').get(groupId, name)
  if (existing) {
    console.log(`    skip  card "${name}"`)
    return existing.id
  }
  const id = randomUUID()
  db.prepare(`
    INSERT INTO cards (id, group_id, name, icon, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, '', ?, ?, ?)
  `).run(id, groupId, name, nextCardOrder(groupId), now(), now())
  console.log(`    +     card "${name}"`)
  return id
}

function upsertItem({ cardId, label, path: itemPath, type, commandArgs = '', workingDir = '', actionId = '' }) {
  const existing = db.prepare('SELECT id FROM items WHERE card_id = ? AND label = ?').get(cardId, label)
  if (existing) {
    console.log(`      skip  item "${label}"`)
    return
  }
  const id = randomUUID()
  db.prepare(`
    INSERT INTO items
      (id, card_id, label, path, type, icon_path, icon_source, note,
       command_args, working_dir, action_id, icon_color,
       sort_order, launch_count, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, '', 'auto', '', ?, ?, ?, '', ?, 0, ?, ?)
  `).run(id, cardId, label, itemPath, type, commandArgs, workingDir, actionId, nextItemOrder(cardId), now(), now())
  console.log(`      +     item "${label}"`)
}

// ── portfolio data ────────────────────────────────────────────────────────────
const PORTFOLIO = [
  {
    name: 'Desktop App Dev', icon: 'Code', iconSource: 'library', iconColor: '', accentColor: '#6366f1',
    cards: [
      { name: 'Editors', items: [
        { label: 'VS Code',      path: 'code',        type: 'software' },
        { label: 'Cursor',       path: 'cursor',      type: 'software' },
        { label: 'Notepad++',    path: 'notepad++',   type: 'software' },
        { label: 'Sublime Text', path: 'subl',        type: 'software' },
      ]},
      { name: 'Version Control', items: [
        { label: 'GitHub',         path: 'https://github.com',                     type: 'url' },
        { label: 'GitKraken',      path: 'gitkraken',                              type: 'software' },
        { label: 'GitHub Desktop', path: 'github',                                 type: 'software' },
        { label: 'Git Log',        path: 'git', commandArgs: 'log --oneline --graph', type: 'command' },
      ]},
      { name: 'Build & Run', items: [
        { label: 'Windows Terminal',  path: 'wt',       type: 'software' },
        { label: 'npm run dev',       path: 'npm',      commandArgs: 'run dev',    type: 'command' },
        { label: 'npm run dist',      path: 'npm',      commandArgs: 'run dist',   type: 'command' },
        { label: 'Electron DevTools', path: 'electron', commandArgs: '--inspect',  type: 'command' },
      ]},
      { name: 'Docs', items: [
        { label: 'Electron Docs',  path: 'https://electronjs.org/docs',    type: 'url' },
        { label: 'MDN Web Docs',   path: 'https://developer.mozilla.org',  type: 'url' },
        { label: 'Stack Overflow', path: 'https://stackoverflow.com',      type: 'url' },
        { label: 'Can I Use',      path: 'https://caniuse.com',            type: 'url' },
      ]},
    ],
  },
  {
    name: 'Web Dev', icon: 'Globe', iconSource: 'library', iconColor: '', accentColor: '#06b6d4',
    cards: [
      { name: 'Frontend', items: [
        { label: 'Tailwind Docs', path: 'https://tailwindcss.com/docs',                       type: 'url' },
        { label: 'MDN CSS',       path: 'https://developer.mozilla.org/en-US/docs/Web/CSS',   type: 'url' },
        { label: 'CSS Tricks',    path: 'https://css-tricks.com',                             type: 'url' },
        { label: 'Vite Docs',     path: 'https://vitejs.dev/guide',                           type: 'url' },
      ]},
      { name: 'Backend', items: [
        { label: 'Node.js Docs', path: 'https://nodejs.org/en/docs',  type: 'url' },
        { label: 'Express Docs', path: 'https://expressjs.com',       type: 'url' },
        { label: 'Postman',      path: 'postman',                     type: 'software' },
        { label: 'Insomnia',     path: 'insomnia',                    type: 'software' },
      ]},
      { name: 'Deploy', items: [
        { label: 'Vercel',   path: 'https://vercel.com/dashboard',   type: 'url' },
        { label: 'Netlify',  path: 'https://app.netlify.com',        type: 'url' },
        { label: 'Railway',  path: 'https://railway.app',            type: 'url' },
        { label: 'Render',   path: 'https://render.com/dashboard',   type: 'url' },
      ]},
      { name: 'Design', items: [
        { label: 'Figma',        path: 'https://figma.com',         type: 'url' },
        { label: 'Excalidraw',   path: 'https://excalidraw.com',    type: 'url' },
        { label: 'Coolors',      path: 'https://coolors.co',        type: 'url' },
        { label: 'Google Fonts', path: 'https://fonts.google.com',  type: 'url' },
      ]},
    ],
  },
  {
    name: 'Data Analytics', icon: 'BarChart2', iconSource: 'library', iconColor: '', accentColor: '#10b981',
    cards: [
      { name: 'Databases', items: [
        { label: 'DBeaver',          path: 'dbeaver',          type: 'software' },
        { label: 'pgAdmin',          path: 'pgadmin4',         type: 'software' },
        { label: 'SQLite Browser',   path: 'sqlitebrowser',    type: 'software' },
        { label: 'MongoDB Compass',  path: 'mongodb-compass',  type: 'software' },
      ]},
      { name: 'Python', items: [
        { label: 'Jupyter Lab',        path: 'http://localhost:8888',             type: 'url' },
        { label: 'Anaconda Navigator', path: 'anaconda-navigator',                type: 'software' },
        { label: 'Python REPL',        path: 'python',  commandArgs: '',          type: 'command' },
        { label: 'pip install',        path: 'pip',     commandArgs: 'install',   type: 'command' },
      ]},
      { name: 'Visualization', items: [
        { label: 'Power BI Desktop', path: 'pbidesk',                          type: 'software' },
        { label: 'Grafana',          path: 'http://localhost:3000',             type: 'url' },
        { label: 'Metabase',         path: 'http://localhost:3001',             type: 'url' },
        { label: 'Tableau Public',   path: 'https://public.tableau.com',       type: 'url' },
      ]},
      { name: 'Data Sources', items: [
        { label: 'Kaggle',          path: 'https://kaggle.com',                                 type: 'url' },
        { label: 'Google Sheets',   path: 'https://sheets.google.com',                          type: 'url' },
        { label: 'Google BigQuery', path: 'https://console.cloud.google.com/bigquery',          type: 'url' },
        { label: 'Excel',           path: 'excel',                                              type: 'software' },
      ]},
    ],
  },
  {
    name: 'Workflow Automation', icon: 'Workflow', iconSource: 'library', iconColor: '', accentColor: '#f97316',
    cards: [
      { name: 'n8n', items: [
        { label: 'n8n Local',     path: 'http://localhost:5678',    type: 'url' },
        { label: 'n8n Cloud',     path: 'https://app.n8n.cloud',    type: 'url' },
        { label: 'n8n Docs',      path: 'https://docs.n8n.io',      type: 'url' },
        { label: 'n8n Community', path: 'https://community.n8n.io', type: 'url' },
      ]},
      { name: 'APIs', items: [
        { label: 'Postman',      path: 'postman',                   type: 'software' },
        { label: 'RapidAPI Hub', path: 'https://rapidapi.com/hub',  type: 'url' },
        { label: 'Webhook.site', path: 'https://webhook.site',      type: 'url' },
        { label: 'Reqbin',       path: 'https://reqbin.com',        type: 'url' },
      ]},
      { name: 'Integrations', items: [
        { label: 'Zapier',    path: 'https://zapier.com/app/dashboard',  type: 'url' },
        { label: 'Make',      path: 'https://make.com',                  type: 'url' },
        { label: 'IFTTT',     path: 'https://ifttt.com',                 type: 'url' },
        { label: 'Pipedream', path: 'https://pipedream.com',             type: 'url' },
      ]},
      { name: 'Schedulers', items: [
        { label: 'Task Scheduler',   path: 'taskschd.msc',  type: 'software' },
        { label: 'Windows Services', path: 'services.msc',  type: 'software' },
        { label: 'Start n8n',        path: 'npm',  commandArgs: 'start',          type: 'command' },
        { label: 'Kill Port 5678',   path: 'npx',  commandArgs: 'kill-port 5678', type: 'command' },
      ]},
    ],
  },
  {
    name: 'Windows Automation', icon: 'Terminal', iconSource: 'library', iconColor: '', accentColor: '#64748b',
    cards: [
      { name: 'AutoHotkey', items: [
        { label: 'AHK Script Editor', path: 'autohotkey',                              type: 'software' },
        { label: 'Run AHK Script',    path: 'autohotkey', commandArgs: 'MyScript.ahk', type: 'command' },
        { label: 'AutoHotkey Docs',   path: 'https://www.autohotkey.com/docs/v2',      type: 'url' },
        { label: 'AHK v2 Forum',      path: 'https://www.autohotkey.com/boards',       type: 'url' },
      ]},
      { name: 'System Actions', items: [
        { label: 'Lock Screen',       path: '', type: 'action', actionId: 'lock_screen'      },
        { label: 'Sleep',             path: '', type: 'action', actionId: 'sleep'             },
        { label: 'Task Manager',      path: '', type: 'action', actionId: 'task_manager'     },
        { label: 'Empty Recycle Bin', path: '', type: 'action', actionId: 'empty_recycle_bin' },
      ]},
      { name: 'Power Tools', items: [
        { label: 'PowerShell ISE', path: 'powershell_ise',  type: 'software' },
        { label: 'Registry Editor', path: 'regedit',        type: 'software' },
        { label: 'Event Viewer',    path: 'eventvwr',       type: 'software' },
        { label: 'System Info',     path: 'msinfo32',       type: 'command'  },
      ]},
      { name: 'Folders', items: [
        { label: 'AppData Roaming', path: '%APPDATA%',      type: 'folder' },
        { label: 'Startup Folder',  path: 'shell:startup',  type: 'folder' },
        { label: 'Temp Folder',     path: '%TEMP%',         type: 'folder' },
        { label: 'Scripts Folder',  path: '',               type: 'folder' },
      ]},
    ],
  },
  {
    name: 'AI / Prompt Engg', icon: 'Sparkles', iconSource: 'library', iconColor: '', accentColor: '#8b5cf6',
    cards: [
      { name: 'Chat AI', items: [
        { label: 'Claude',      path: 'https://claude.ai',           type: 'url' },
        { label: 'ChatGPT',     path: 'https://chatgpt.com',         type: 'url' },
        { label: 'Gemini',      path: 'https://gemini.google.com',   type: 'url' },
        { label: 'Perplexity',  path: 'https://perplexity.ai',       type: 'url' },
      ]},
      { name: 'Local AI', items: [
        { label: 'Ollama Serve', path: 'ollama',            commandArgs: 'serve', type: 'command'  },
        { label: 'LM Studio',   path: 'lmstudio',                                type: 'software' },
        { label: 'Jan AI',      path: 'jan',                                     type: 'software' },
        { label: 'Open WebUI',  path: 'http://localhost:11434',                  type: 'url'      },
      ]},
      { name: 'APIs & SDKs', items: [
        { label: 'Anthropic Docs', path: 'https://docs.anthropic.com',           type: 'url' },
        { label: 'OpenAI Docs',    path: 'https://platform.openai.com/docs',     type: 'url' },
        { label: 'HuggingFace',    path: 'https://huggingface.co',               type: 'url' },
        { label: 'Replicate',      path: 'https://replicate.com',                type: 'url' },
      ]},
      { name: 'Prompt Tools', items: [
        { label: 'PromptBase', path: 'https://promptbase.com',  type: 'url' },
        { label: 'FlowGPT',   path: 'https://flowgpt.com',     type: 'url' },
        { label: 'OpenPrompt', path: 'https://openprompt.co',  type: 'url' },
        { label: 'AIPRM',     path: 'https://www.aiprm.com',   type: 'url' },
      ]},
    ],
  },
]

// ── run in a single transaction ───────────────────────────────────────────────
const seed = db.transaction(() => {
  for (const group of PORTFOLIO) {
    const groupId = upsertGroup(group)
    for (const card of group.cards) {
      const cardId = upsertCard({ groupId, name: card.name })
      for (const item of card.items) {
        upsertItem({ cardId, ...item })
      }
    }
  }
})

try {
  seed()
  console.log('\nSeeding complete. Restart Command-Center to see all 6 groups.')
} catch (e) {
  console.error('\nSeed failed:', e.message)
  process.exit(1)
} finally {
  db.close()
}
