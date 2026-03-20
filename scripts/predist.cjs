const fs = require('fs')
const path = require('path')

const releaseDir = path.join(__dirname, '..', 'release')

if (!fs.existsSync(releaseDir)) {
  console.log('release/ not found, skipping clean.')
  process.exit(0)
}

try {
  fs.rmSync(releaseDir, { recursive: true, force: true })
  console.log('Cleaned release/')
} catch (e) {
  console.error(`Could not clean release/: ${e.message}`)
  console.error('If locked by Windows Defender, add the release/ folder to Defender exclusions.')
  process.exit(1)
}
