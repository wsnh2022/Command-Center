const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const releaseDir = path.join(__dirname, '..', 'release')

if (!fs.existsSync(releaseDir)) {
  console.log('release/ not found, skipping clean.')
  process.exit(0)
}

function sleep(ms) {
  spawnSync('powershell', ['-NoProfile', '-Command', `Start-Sleep -Milliseconds ${ms}`], { stdio: 'ignore' })
}

// Retry up to 8 times with progressive backoff — handles Defender's async scan lock
const MAX_ATTEMPTS = 8
let lastError

for (let i = 1; i <= MAX_ATTEMPTS; i++) {
  try {
    fs.rmSync(releaseDir, { recursive: true, force: true })
    console.log('Cleaned release/')
    process.exit(0)
  } catch (e) {
    lastError = e
    const wait = i * 2000
    console.log(`Attempt ${i}/${MAX_ATTEMPTS} — folder locked (${e.code}), waiting ${wait / 1000}s...`)
    sleep(wait)
  }
}

console.error(
  `\nCould not clean release/ after ${MAX_ATTEMPTS} attempts (${MAX_ATTEMPTS * (MAX_ATTEMPTS + 1)}s total).\n` +
  `Root cause: Windows Defender is holding a lock on the .exe files after scanning.\n\n` +
  `Permanent fix — add this folder to Defender exclusions:\n` +
  `  C:\\dev\\Command_Center_Project_Assets\\release\n\n` +
  `  Settings -> Windows Security -> Virus & threat protection\n` +
  `  -> Manage settings -> Exclusions -> Add an exclusion -> Folder\n\n` +
  `One-time fix: delete the release/ folder manually, then run npm run dist again.`
)
process.exit(1)
