# Reddit Post - Command-Center

> Copy the title and body into Reddit. Suggested subreddits listed at the bottom.

---

## Title

I built a personal Windows desktop control center with AI help - and learned that AI is genuinely dumb in ways that only show up when you're deep in a project

---

## Body

Hey everyone,

I just open-sourced a side project: **Command-Center** - a personal Windows desktop hub that puts every tool, URL, folder, script, and system command behind a single global keyboard shortcut.

**GitHub:** https://github.com/wsnh2022/command-center

---

**What it does:**

`Ctrl+Shift+Space` from anywhere on Windows brings the window up. Everything I use - dev tools, n8n workflows, AutoHotkey scripts, data folders, personal links, system commands - organized into groups and cards, searchable, launchable in one click. Minimizes to tray and stays running in the background.

Some features that ended up being non-trivial to build:

- Fuzzy search (Fuse.js) + full-text note search (SQLite FTS5)
- Webview popups via BrowserView - isolated Chromium sessions, eject to browser, always-on-top pin
- Icon system - favicons, custom uploads, Lucide library icons, emoji, base64, all stored locally
- Drag-to-reorder items across cards, cards within groups, groups in the sidebar
- Auto-backup on every write (rolling 10 snapshots), full ZIP export/import

Stack: Electron 30 + React 18 + TypeScript + Tailwind + SQLite (better-sqlite3)

*(Quick note: the screenshots in the repo use demo content assembled to show the interface - not my actual dashboard. Think of it as a furnished showroom.)*

---

**The honest part - built with AI (Claude Code):**

I want to be upfront: the code was written with AI assistance. But I also want to be honest about what that actually looks like from inside it.

AI writes code fast. What it doesn't do is understand your project.

Every new feature brought bugs that took days to track down - situations where the AI would confidently produce a fix that looked right but quietly broke something three layers away. It couldn't feel that something was wrong, couldn't hold the mental model of how the system connected, couldn't tell which solution actually fit. That gap - between generating code and understanding a system - is where human intuition is irreplaceable. Every meaningful judgment call was still mine.

I came out of this convinced that AI won't replace developers. It will just make the ones who actually understand what they're building significantly faster. The understanding is still the hard part.

---

**Why I built it instead of using an existing tool:**

I tried Notion, Obsidian dashboards, pinned taskbars, browser bookmarks, and a few launcher apps. None of them gave me what I wanted - a hierarchical, searchable, keyboard-accessible view of everything, personal and professional, organized the way I actually think. Been using it daily for the past week and it's already changed how I start my day.

---

Happy to answer questions about the architecture, the AI experience, or anything else. README has full docs, screenshots, and GIFs.

---

## Suggested Subreddits

| Subreddit | Best angle to lead with |
|---|---|
| r/sideprojects | General share - lead with what it does |
| r/windows | Lead with the global shortcut + tray behaviour |
| r/productivity | Lead with the fragmentation problem it solves |
| r/electronjs | Lead with the stack and architecture decisions |
| r/ClaudeAI | Lead with the honest AI reflection |
| r/learnprogramming | Lead with what the debugging taught you |
| r/selfhosted | Lead with 100% local, no cloud, no accounts |

> **Tip:** Swap the opening paragraph to match each subreddit's vibe - the rest of the post stays the same.
