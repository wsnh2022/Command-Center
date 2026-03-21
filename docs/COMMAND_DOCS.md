# Command Center — Item Setup Reference

> Complete guide for every item type. Written for first-time users and experienced developers alike.
> Each type has: what it does, what to fill in, and real examples.

---

## How to Read This Guide

Every item in Command Center has a **Type**. The type controls which fields appear and how the item launches.

| Type | What it opens |
|---|---|
| **URL** | A website or local web server in your browser |
| **Software** | An app, script, or file on your machine |
| **Folder** | A folder in Windows Explorer |
| **Command** | A terminal command — runs in a persistent window |

> **Note:** The Action type has been removed. All system actions (lock screen, sleep, calculator, etc.)
> are now set up as Command items using the Quick Templates system. See the Command section below.

---

## TYPE: URL

**What it does:** Opens any web address in your default browser.

| Field | What to enter |
|---|---|
| URL | Full web address — must start with `https://` or `http://` |

**Examples:**

```
https://github.com
http://localhost:5173          ← local dev server
http://localhost:3000/admin    ← local app with path
```

> The icon is fetched automatically from the site's favicon. No manual setup needed.

---

## TYPE: SOFTWARE

**What it does:** Opens any `.exe`, `.py`, `.pdf`, `.docx`, or any file Windows knows how to handle.

| Field | What to enter |
|---|---|
| Path | Full path to the file on your computer |

> Use the **Browse button** (folder icon) — it fills the path and extracts the icon automatically.

**Examples:**

```
C:\Program Files\Notepad++\notepad++.exe
C:\dev\tools\report_generator.py
C:\Users\Yogi\Documents\project_brief.pdf
```

---

## TYPE: FOLDER

**What it does:** Opens a folder directly in Windows Explorer.

| Field | What to enter |
|---|---|
| Folder Path | Full path to the folder |

**Examples:**

```
C:\dev
C:\dev\Electron_Project\Command_Center_Dashboard
D:\Shared\Team_Files
```

---

## TYPE: COMMAND

**What it does:** Runs a terminal command in a persistent window. The most powerful item type.

| Field | Required | What to enter |
|---|---|---|
| **Command** | Yes | Executable to run — `cmd`, `powershell`, `npm`, `python`, `node`, `git` |
| **Arguments** | Optional | Everything after the command |
| **Working Directory** | Optional* | Folder the command runs inside |

> `*` Working Directory is **critical** for any command tied to a project.
> npm, git, python scripts — all fail silently if run from the wrong folder.
> Leave empty to open in your home folder (`C:\Users\YourName`).

---

### Why `cmd /K` and not the command directly?

`/K` tells `cmd.exe` to run the command and **keep the window open**.
Without it: terminal flashes and closes. You see nothing.

**Always use `cmd /K <your command>` when you want output to stay visible.**

---

### How command launching works

Commands are launched via `cmd.exe /c start` — this opens a new independent terminal window.
The working directory defaults to your user home folder when left empty.
Arguments are passed as a raw string so complex syntax (pipes, loops, quotes) works correctly.

---

### Full Command Cheatsheet

#### Shells — no Working Directory needed

```
TASK                    COMMAND       ARGUMENTS
────────────────────────────────────────────────────────
PowerShell (stays open) powershell    -NoExit
CMD (stays open)        cmd           /K echo Ready
Windows Terminal        wt
Node.js REPL            node
Python interactive      python
```

#### Dev Servers — Working Directory = your project root

```
TASK              COMMAND   ARGUMENTS
──────────────────────────────────────────────────────────────────────
npm run dev       cmd       /K npm run dev
npm start         cmd       /K npm start
npm run build     cmd       /K npm run build
npx vite          cmd       /K npx vite
FastAPI uvicorn   cmd       /K python -m uvicorn main:app --reload
Django            cmd       /K python manage.py runserver
```

#### Package Managers — Working Directory = your project root

```
TASK              COMMAND   ARGUMENTS
──────────────────────────────────────────────────────────────────────
npm install       cmd       /K npm install
pip install       cmd       /K pip install -r requirements.txt
pip list          cmd       /K pip list
```

#### Git — Working Directory = your repo root

```
TASK              COMMAND   ARGUMENTS
──────────────────────────────────────────────────────────────────────
git status        cmd       /K git status
git pull          cmd       /K git pull
git log           cmd       /K git log --oneline -20
git diff          cmd       /K git diff
```

#### System Tools — no Working Directory needed

```
TASK              COMMAND   ARGUMENTS
──────────────────────────────────────────────────────────────────────
tasklist          cmd       /K tasklist /v
disk usage        cmd       /K wmic logicaldisk get size,freespace,caption
flush DNS         cmd       /K ipconfig /flushdns
ipconfig          cmd       /K ipconfig /all
hosts file        cmd       /K notepad C:\Windows\System32\drivers\etc\hosts
env vars          cmd       /K set
ping              cmd       /K ping google.com -t
```

#### Network — no Working Directory needed

```
TASK              COMMAND   ARGUMENTS
──────────────────────────────────────────────────────────────────────
curl GET          cmd       /K curl https://httpbin.org/get
curl POST         cmd       /K curl -X POST https://httpbin.org/post
ngrok 5173        cmd       /K ngrok http 5173
ngrok 3000        cmd       /K ngrok http 3000
netstat           cmd       /K netstat -ano
port check        cmd       /K netstat -ano | findstr :3000
```

#### Docker — compose commands need Working Directory = project root

```
TASK              COMMAND   ARGUMENTS
──────────────────────────────────────────────────────────────────────
docker ps         cmd       /K docker ps
docker ps all     cmd       /K docker ps -a
docker images     cmd       /K docker images
compose up        cmd       /K docker compose up -d
compose down      cmd       /K docker compose down
compose logs      cmd       /K docker compose logs -f
```

#### Python / Venv — Working Directory = your project root

```
TASK              COMMAND   ARGUMENTS
──────────────────────────────────────────────────────────────────────
create venv       cmd       /K python -m venv venv
activate venv     cmd       /K venv\Scripts\activate
run script        cmd       /K python main.py
freeze deps       cmd       /K pip freeze > requirements.txt
deactivate        cmd       /K deactivate
```

#### Node / Runtime — project commands need Working Directory

```
TASK              COMMAND   ARGUMENTS
──────────────────────────────────────────────────────────────────────
run index.js      cmd       /K node index.js
ts-node           cmd       /K npx ts-node src/index.ts
npm list          cmd       /K npm list --depth=0
npm outdated      cmd       /K npm outdated
node version      cmd       /K node --version && npm --version
```

#### Ports — no Working Directory needed

```
TASK              COMMAND       ARGUMENTS
──────────────────────────────────────────────────────────────────────────────────────────────
who uses :3000    cmd           /K netstat -ano | findstr :3000
who uses :5173    cmd           /K netstat -ano | findstr :5173
who uses :8080    cmd           /K netstat -ano | findstr :8080
kill :3000        powershell    -NoExit -Command "Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force; Write-Host Killed PID $_ }; Write-Host Done"
node procs        cmd           /K tasklist | findstr node
python procs      cmd           /K tasklist | findstr python
```

#### SSH — no Working Directory needed, edit args after applying

```
TASK              COMMAND   ARGUMENTS (edit after applying)
──────────────────────────────────────────────────────────────────────
SSH connect       cmd       /K ssh user@your-server-ip
SSH with key      cmd       /K ssh -i C:\path\to\key.pem user@host
SCP upload        cmd       /K scp file.txt user@host:/remote/path
SCP download      cmd       /K scp user@host:/remote/file.txt .
```

---

## Quick Templates

When type is set to **Command**, a **Quick Templates** section appears above the fields.
Click a category button → dropdown opens → click a template → all three fields fill instantly.

Templates that need a Working Directory show a `set dir` label on the right side of their row.
After applying, browse-select your project root in the Working Directory field.

### Template Categories

| Category | Templates | Working Dir needed |
|---|---|---|
| Shells | PowerShell, CMD, Windows Terminal, Node REPL, Python Shell | No |
| Dev Server | npm run dev, npm start, npm run build, npx vite, uvicorn, Django | Yes |
| Git | git status, git pull, git log, git diff | Yes |
| Packages | npm install, pip install, pip list | Mix |
| System | tasklist, disk usage, flush DNS, ipconfig, hosts file, env vars, ping | No |
| Network | curl GET, curl POST, ngrok 5173/3000, netstat, port check | No |
| Docker | ps, ps all, images, compose up/down/logs | Mix |
| Python | create venv, activate venv, run script, freeze deps, deactivate | Mix |
| Node | run index.js, ts-node, npm list, npm outdated, node version | Mix |
| Ports | who uses :3000/5173/8080, kill :3000, node/python procs | No |
| SSH | SSH connect, SSH with key, SCP upload/download | No |

---

## 3 Full Examples

```
Example 1 — Start the Command Center dev server
Command:       cmd
Arguments:     /K npm run dev
Working Dir:   C:\dev\Electron_Project\Command_Center_Dashboard

Example 2 — Git status in a repo
Command:       cmd
Arguments:     /K git status
Working Dir:   C:\dev\n8n-form-to-inbox-automation

Example 3 — Open PowerShell anywhere
Command:       powershell
Arguments:     -NoExit
Working Dir:   (leave empty)
```

---

## Common Mistakes

| Mistake | Why it fails | Fix |
|---|---|---|
| `npm run dev` directly in Command field | `npm` is a `.cmd` file needing a shell wrapper | Use `cmd` in Command, `/K npm run dev` in Arguments |
| Empty Working Dir for npm/git | Command runs in wrong folder, fails silently | Set Working Dir to your project root |
| `cmd /K` with nothing after it | Opens CMD but runs nothing | Put the command after `/K` — e.g. `/K npm run dev` |
| `powershell -Command` instead of `-NoExit` | Window runs and closes immediately | Use `-NoExit` to keep the window open |
| Running kill :3000 — window closes instantly | Complex CMD syntax broken by shell wrapping | Template uses PowerShell — expected output is `Done` or `Killed PID XXXXX` |

---

*Last updated: Command Center — docs/COMMAND_DOCS.md*
